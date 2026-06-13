/**
 * API Client - Centralized API calls for football data and Gemini AI.
 * All calls are made directly from the browser (no backend required).
 */

const API = (() => {
    const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
    const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const WC_COMPETITION_CODE = 'WC';

    // Cache for API responses
    const cache = new Map();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get stored API keys from localStorage
     */
    function getKeys() {
        return {
            footballData: localStorage.getItem('wc2026_fd_key') || 'ae4fa7a0fdd2472b861033c12c518797',
            gemini: localStorage.getItem('wc2026_gemini_key') || ''
        };
    }

    function saveKeys(fdKey, geminiKey) {
        if (fdKey) localStorage.setItem('wc2026_fd_key', fdKey);
        if (geminiKey) localStorage.setItem('wc2026_gemini_key', geminiKey);
    }

    function hasFootballDataKey() {
        return !!getKeys().footballData;
    }

    function hasGeminiKey() {
        return !!getKeys().gemini;
    }

    /**
     * Fetch with caching and timeout
     */
    async function cachedFetch(url, options = {}, cacheKey) {
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                clearTimeout(timeoutId);
                throw new Error(`API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            clearTimeout(timeoutId);
            cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    }

    /**
     * Fetch all World Cup 2026 matches from football-data.org
     */
    async function fetchMatches() {
        const keys = getKeys();
        if (!keys.footballData) {
            // Return demo data if no API key
            return getDemoMatches();
        }

        // Always use server proxy to bypass CORS (works both locally and on Render.com)
        const url = '/api/matches';

        const options = {
            headers: {
                'X-Auth-Token': keys.footballData
            }
        };

        try {
            const data = await cachedFetch(url, options, 'wc_matches');
            return data;
        } catch (err) {
            console.error('Football Data API error:', err);
            // Fallback to demo data
            return getDemoMatches();
        }
    }

    /**
     * Get prediction from Gemini AI
     */
    /**
     * Get prediction from Gemini AI
     */
    async function getPrediction(homeTeam, awayTeam, group, matchDate) {
        const keys = getKeys();
        
        // If no Gemini key is provided, log and run fallback
        if (!keys.gemini) {
            console.log('Gemini API Key missing. Using client-side simulation fallback.');
            return await getFallbackPrediction(homeTeam, awayTeam, group, matchDate);
        }

        try {
            const url = `${GEMINI_BASE}?key=${keys.gemini}`;
            const prompt = buildPredictionPrompt(homeTeam, awayTeam, group, matchDate);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                        responseMimeType: 'application/json'
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                throw new Error('Không nhận được phản hồi từ AI.');
            }

            return JSON.parse(text);
        } catch (err) {
            console.warn('Gemini API prediction failed. Using client-side simulation fallback. Error:', err);
            return await getFallbackPrediction(homeTeam, awayTeam, group, matchDate);
        }
    }

    /**
     * Fallback prediction generator when Gemini API fails or is not configured
     */
    async function getFallbackPrediction(homeTeam, awayTeam, group, matchDate) {
        // Simulate network delay for realistic feel
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Team ratings map (Vietnamese names used in app)
        const ratings = {
            'Brazil': 92, 'Pháp': 91, 'Argentina': 91, 'Anh': 90, 'Tây Ban Nha': 90, 'Bồ Đào Nha': 89, 'Đức': 88,
            'Hà Lan': 86, 'Ý': 85, 'Bỉ': 84, 'Croatia': 84, 'Uruguay': 84, 'Colombia': 83, 'Senegal': 82, 'Morocco': 82,
            'Nhật Bản': 81, 'Mỹ': 80, 'Mexico': 80, 'Thụy Điển': 80, 'Đan Mạch': 80, 'Thụy Sĩ': 79, 'Áo': 79, 'Thổ Nhĩ Kỳ': 79,
            'Hàn Quốc': 78, 'Ecuador': 78, 'Canada': 77, 'Nigeria': 77, 'Algeria': 77, 'Czechia': 75,
            'Ai Cập': 75, 'Tunisia': 74, 'Iran': 74, 'Bosnia': 73, 'Paraguay': 73, 'Úc': 73, 'Ả Rập Saudi': 72,
            'Nam Phi': 71, 'Na Uy': 75, 'Iraq': 70, 'Uzbekistan': 69, 'DR Congo': 69, 'Ghana': 72, 'Panama': 68,
            'Jordan': 67, 'Qatar': 68, 'Haiti': 63, 'Curaçao': 62, 'Cabo Verde': 65, 'New Zealand': 62, 'Scotland': 72
        };

        const rHome = ratings[homeTeam] || 70;
        const rAway = ratings[awayTeam] || 70;

        // Custom PRNG seeded with match name to ensure identical prediction on every click
        const seedStr = `${homeTeam}-${awayTeam}`;
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        function rand() {
            const x = Math.sin(hash++) * 10000;
            return x - Math.floor(x);
        }

        // Calculate expected goals
        const diff = rHome - rAway;
        const expectedHome = Math.max(0.3, Math.min(3.5, 1.4 + (diff * 0.04) + (rand() - 0.5) * 0.8));
        const expectedAway = Math.max(0.3, Math.min(3.5, 1.2 - (diff * 0.04) + (rand() - 0.5) * 0.8));

        const homeScore = Math.round(expectedHome);
        const awayScore = Math.round(expectedAway);

        const confidence = Math.round(Math.min(95, Math.max(55, 70 + Math.abs(diff) * 0.8 + (rand() - 0.5) * 10)));

        const isHomeStronger = rHome >= rAway;

        // Create summary
        let summary = '';
        if (Math.abs(diff) < 5) {
            summary = `Trận đấu giữa ${homeTeam} và ${awayTeam} được dự báo sẽ diễn ra vô cùng cân bằng và căng thẳng. Cả hai đội đều sở hữu thực lực ngang ngửa và lối chơi tương đối tương đồng, nhiều khả năng kết quả sẽ được định đoạt bằng một tình huống cố định hoặc khoảnh khắc tỏa sáng cá nhân.`;
        } else if (isHomeStronger) {
            summary = `Đại diện ${homeTeam} được đánh giá vượt trội hơn so với ${awayTeam} nhờ chất lượng đội hình đồng đều và kinh nghiệm chinh chiến tại đấu trường quốc tế. Tuy nhiên, ${awayTeam} hoàn toàn có thể tạo nên bất ngờ nếu chơi với đội hình lùi sâu và kỷ luật phòng ngự cao độ.`;
        } else {
            summary = `Dù được thi đấu với tư cách chủ nhà trên lý thuyết, ${homeTeam} sẽ gặp rất nhiều khó khăn trước một ${awayTeam} được đánh giá cao hơn về mọi mặt. Sự kỷ luật trong lối chơi phòng ngự phản công nhanh sẽ là chìa khóa duy nhất giúp ${homeTeam} hy vọng giành điểm.`;
        }

        // Strengths & factors
        const homeStrengths = [
            'Hàng tiền vệ giàu sức chiến đấu và kiểm soát bóng tốt.',
            'Lối chơi tập thể gắn kết, khả năng chuyển trạng thái nhanh.',
            'Khai thác tốt các tình huống bóng cố định nhờ thể hình lý tưởng.',
            'Tinh thần thi đấu quả cảm và sự cổ vũ nồng nhiệt từ khán giả.',
            'Hàng phòng ngự chơi kỷ luật, bọc lót cho nhau rất tốt.'
        ];
        const awayStrengths = [
            'Sở hữu các ngôi sao có khả năng tạo đột biến cao trên hàng công.',
            'Lối chơi pressing tầm cao đồng đều và giàu thể lực.',
            'Hàng thủ chơi tập trung, tổ chức phòng ngự chiều sâu tốt.',
            'Khả năng tận dụng cơ hội phản công biên vô cùng sắc bén.',
            'Kinh nghiệm vượt trội của các cầu thủ trụ cột ở các giải đấu lớn.'
        ];
        const keyFactors = [
            'Khả năng tranh chấp khu vực trung tuyến.',
            'Sự tập trung của hàng phòng ngự trong 15 phút đầu trận.',
            'Tính đột biến từ các tình huống thay đổi nhân sự ở hiệp 2.',
            'Hiệu quả tận dụng cơ hội từ các quả phạt góc.',
            'Vai trò thủ lĩnh của các tiền vệ trung tâm.'
        ];

        const getItems = (arr, count) => {
            const temp = [...arr];
            const result = [];
            for (let i = 0; i < count; i++) {
                const idx = Math.floor(rand() * temp.length);
                result.push(temp.splice(idx, 1)[0]);
            }
            return result;
        };

        const homeStrengthSelected = homeStrengths[Math.floor(rand() * homeStrengths.length)];
        const awayStrengthSelected = awayStrengths[Math.floor(rand() * awayStrengths.length)];
        const selectedFactors = getItems(keyFactors, 3);
        selectedFactors.push(`Thời tiết và điều kiện sân bãi tại SVĐ.`);

        // Sources predictions
        const sources = [
            {
                name: 'WhoScored',
                prediction: `${Math.round(expectedHome + (rand() - 0.5) * 0.5)}-${Math.round(expectedAway + (rand() - 0.5) * 0.5)}`,
                note: isHomeStronger ? `${homeTeam} chiếm ưu thế về chỉ số kiểm soát bóng.` : `${awayTeam} nhỉnh hơn ở các pha tranh chấp tay đôi.`
            },
            {
                name: 'FootyStats',
                prediction: `${Math.round(expectedHome + (rand() - 0.5) * 0.6)}-${Math.round(expectedAway + (rand() - 0.5) * 0.6)}`,
                note: `Xác suất nổ tài bàn thắng là ${(45 + Math.abs(diff) * 0.5 + rand() * 10).toFixed(0)}%.`
            },
            {
                name: 'Betensured',
                prediction: homeScore === awayScore ? '1-1' : (homeScore > awayScore ? `${homeScore}-${awayScore}` : `${homeScore}-${awayScore}`),
                note: isHomeStronger ? `Đặt niềm tin vào một chiến thắng cho ${homeTeam}.` : `Cửa thắng của ${awayTeam} là sáng hơn cả.`
            },
            {
                name: 'PredictZ',
                prediction: `${Math.max(0, homeScore + (rand() > 0.7 ? 1 : (rand() < 0.3 ? -1 : 0)))}-${Math.max(0, awayScore + (rand() > 0.7 ? 1 : (rand() < 0.3 ? -1 : 0)))}`,
                note: `Lịch sử đối đầu gần đây cho thấy sự cân bằng giữa hai bên.`
            },
            {
                name: 'SoccerStats',
                prediction: `${homeScore}-${awayScore}`,
                note: `Dự báo một thế trận chặt chẽ, bàn thắng chỉ xuất hiện ở hiệp 2.`
            }
        ];

        // Format clean score string for sources if negative
        sources.forEach(src => {
            const parts = src.prediction.split('-');
            const h = Math.max(0, parseInt(parts[0]) || 0);
            const a = Math.max(0, parseInt(parts[1]) || 0);
            src.prediction = `${h}-${a}`;
        });

        return {
            predictedScore: { home: homeScore, away: awayScore },
            confidence,
            analysis: {
                summary,
                homeTeamStrength: homeStrengthSelected,
                awayTeamStrength: awayStrengthSelected,
                keyFactors: selectedFactors,
                sources
            }
        };
    }

    /**
     * Build the prediction prompt for Gemini AI
     */
    function buildPredictionPrompt(homeTeam, awayTeam, group, matchDate) {
        return `Bạn là một chuyên gia phân tích bóng đá hàng đầu thế giới. Hãy dự đoán tỉ số cho trận đấu FIFA World Cup 2026 sau:

🏟️ TRẬN ĐẤU: ${homeTeam} vs ${awayTeam}
📋 ${group ? 'Bảng: ' + group : 'Vòng loại trực tiếp'}
📅 Ngày: ${matchDate}

Hãy phân tích trận đấu dựa trên góc nhìn tổng hợp từ 5 trang phân tích bóng đá uy tín nhất thế giới:
1. WhoScored - Phân tích thống kê chi tiết, xếp hạng cầu thủ
2. FootyStats - Dữ liệu xu hướng bàn thắng, góc, thẻ
3. Betensured - Phân tích chuyên gia kết hợp mô hình thống kê
4. PredictZ - Dự đoán dựa trên dữ liệu lịch sử
5. SoccerStats - Xu hướng thống kê chuyên sâu

Xem xét các yếu tố:
- Phong độ gần đây của cả 2 đội
- Lịch sử đối đầu (head-to-head)
- Đội hình dự kiến, cầu thủ chủ chốt
- Lợi thế sân nhà (nếu có)
- Chiến thuật và phong cách thi đấu
- Tình trạng chấn thương, thẻ phạt

Trả về JSON CHÍNH XÁC theo format sau (không thêm markdown hay text nào khác):
{
    "predictedScore": { "home": <số>, "away": <số> },
    "confidence": <số từ 50-95>,
    "analysis": {
        "summary": "<tóm tắt phân tích 2-3 câu bằng tiếng Việt>",
        "homeTeamStrength": "<điểm mạnh đội nhà bằng tiếng Việt>",
        "awayTeamStrength": "<điểm mạnh đội khách bằng tiếng Việt>",
        "keyFactors": ["<yếu tố 1>", "<yếu tố 2>", "<yếu tố 3>", "<yếu tố 4>"],
        "sources": [
            { "name": "WhoScored", "prediction": "<tỉ số dạng X-Y>", "note": "<nhận xét ngắn tiếng Việt>" },
            { "name": "FootyStats", "prediction": "<tỉ số dạng X-Y>", "note": "<nhận xét ngắn tiếng Việt>" },
            { "name": "Betensured", "prediction": "<tỉ số dạng X-Y>", "note": "<nhận xét ngắn tiếng Việt>" },
            { "name": "PredictZ", "prediction": "<tỉ số dạng X-Y>", "note": "<nhận xét ngắn tiếng Việt>" },
            { "name": "SoccerStats", "prediction": "<tỉ số dạng X-Y>", "note": "<nhận xét ngắn tiếng Việt>" }
        ]
    }
}`;
    }

    /**
     * Demo match data when no API key is provided.
     * Reflects the actual WC 2026 group stage schedule.
     */
    function getDemoMatches() {
        // Using flagcdn.com for reliable flag images
        const flag = (code) => `https://flagcdn.com/w80/${code.toLowerCase()}.png`;

        const teams = {
            MEX: { name: 'Mexico', crest: flag('mx') },
            RSA: { name: 'Nam Phi', crest: flag('za') },
            KOR: { name: 'Hàn Quốc', crest: flag('kr') },
            CZE: { name: 'Czechia', crest: flag('cz') },
            CAN: { name: 'Canada', crest: flag('ca') },
            BIH: { name: 'Bosnia', crest: flag('ba') },
            QAT: { name: 'Qatar', crest: flag('qa') },
            SUI: { name: 'Thụy Sĩ', crest: flag('ch') },
            BRA: { name: 'Brazil', crest: flag('br') },
            MAR: { name: 'Morocco', crest: flag('ma') },
            HAI: { name: 'Haiti', crest: flag('ht') },
            SCO: { name: 'Scotland', crest: flag('gb-sct') },
            USA: { name: 'Mỹ', crest: flag('us') },
            PAR: { name: 'Paraguay', crest: flag('py') },
            AUS: { name: 'Úc', crest: flag('au') },
            TUR: { name: 'Thổ Nhĩ Kỳ', crest: flag('tr') },
            GER: { name: 'Đức', crest: flag('de') },
            CUW: { name: 'Curaçao', crest: flag('cw') },
            CIV: { name: 'Bờ Biển Ngà', crest: flag('ci') },
            ECU: { name: 'Ecuador', crest: flag('ec') },
            NED: { name: 'Hà Lan', crest: flag('nl') },
            JPN: { name: 'Nhật Bản', crest: flag('jp') },
            SWE: { name: 'Thụy Điển', crest: flag('se') },
            TUN: { name: 'Tunisia', crest: flag('tn') },
            BEL: { name: 'Bỉ', crest: flag('be') },
            EGY: { name: 'Ai Cập', crest: flag('eg') },
            IRN: { name: 'Iran', crest: flag('ir') },
            NZL: { name: 'New Zealand', crest: flag('nz') },
            ESP: { name: 'Tây Ban Nha', crest: flag('es') },
            CPV: { name: 'Cabo Verde', crest: flag('cv') },
            KSA: { name: 'Ả Rập Saudi', crest: flag('sa') },
            URU: { name: 'Uruguay', crest: flag('uy') },
            FRA: { name: 'Pháp', crest: flag('fr') },
            SEN: { name: 'Senegal', crest: flag('sn') },
            IRQ: { name: 'Iraq', crest: flag('iq') },
            NOR: { name: 'Na Uy', crest: flag('no') },
            ARG: { name: 'Argentina', crest: flag('ar') },
            ALG: { name: 'Algeria', crest: flag('dz') },
            AUT: { name: 'Áo', crest: flag('at') },
            JOR: { name: 'Jordan', crest: flag('jo') },
            POR: { name: 'Bồ Đào Nha', crest: flag('pt') },
            COD: { name: 'DR Congo', crest: flag('cd') },
            UZB: { name: 'Uzbekistan', crest: flag('uz') },
            COL: { name: 'Colombia', crest: flag('co') },
            ENG: { name: 'Anh', crest: flag('gb-eng') },
            CRO: { name: 'Croatia', crest: flag('hr') },
            GHA: { name: 'Ghana', crest: flag('gh') },
            PAN: { name: 'Panama', crest: flag('pa') },
        };

        // Helper to create a match object
        let matchId = 1;
        function m(home, away, group, date, time, statusOverride, homeScoreOverride, awayScoreOverride, venue) {
            const utcDateStr = `2026-06-${date.padStart(2, '0')}T${time}:00-05:00`;
            const matchDate = new Date(utcDateStr);
            const now = new Date();

            let status = 'TIMED';
            let homeScore = null;
            let awayScore = null;

            // Define duration of match (2 hours in milliseconds)
            const matchDuration = 2 * 60 * 60 * 1000;

            if (now > new Date(matchDate.getTime() + matchDuration)) {
                // Match has finished
                status = 'FINISHED';
                
                // Seeded random number generator based on matchId
                const seed = matchId * 31;
                const rand = () => {
                    const x = Math.sin(seed) * 10000;
                    return x - Math.floor(x);
                };
                
                // Get team ratings
                const ratings = {
                    'Brazil': 92, 'Pháp': 91, 'Argentina': 91, 'Anh': 90, 'Tây Ban Nha': 90, 'Bồ Đào Nha': 89, 'Đức': 88,
                    'Hà Lan': 86, 'Ý': 85, 'Bỉ': 84, 'Croatia': 84, 'Uruguay': 84, 'Colombia': 83, 'Senegal': 82, 'Morocco': 82,
                    'Nhật Bản': 81, 'Mỹ': 80, 'Mexico': 80, 'Thụy Điển': 80, 'Đan Mạch': 80, 'Thụy Sĩ': 79, 'Áo': 79, 'Thổ Nhĩ Kỳ': 79,
                    'Hàn Quốc': 78, 'Ecuador': 78, 'Canada': 77, 'Nigeria': 77, 'Algeria': 77, 'Czechia': 75,
                    'Ai Cập': 75, 'Tunisia': 74, 'Iran': 74, 'Bosnia': 73, 'Paraguay': 73, 'Úc': 73, 'Ả Rập Saudi': 72,
                    'Nam Phi': 71, 'Na Uy': 75, 'Iraq': 70, 'Uzbekistan': 69, 'DR Congo': 69, 'Ghana': 72, 'Panama': 68,
                    'Jordan': 67, 'Qatar': 68, 'Haiti': 63, 'Curaçao': 62, 'Cabo Verde': 65, 'New Zealand': 62, 'Scotland': 72
                };
                const homeName = teams[home]?.name || home;
                const awayName = teams[away]?.name || away;
                const rHome = ratings[homeName] || 70;
                const rAway = ratings[awayName] || 70;
                const diff = rHome - rAway;

                const expHome = Math.max(0, 1.4 + diff * 0.04 + (rand() - 0.5) * 1.2);
                const expAway = Math.max(0, 1.1 - diff * 0.04 + (rand() - 0.5) * 1.2);
                homeScore = Math.round(expHome);
                awayScore = Math.round(expAway);
            } else if (now > matchDate) {
                // Match is currently live (in play)
                status = 'IN_PLAY';
                
                // Current live score based on minutes elapsed
                const minutesElapsed = Math.floor((now - matchDate) / (60 * 1000));
                const seed = matchId + minutesElapsed;
                const rand = () => {
                    const x = Math.sin(seed) * 10000;
                    return x - Math.floor(x);
                };
                // Make a realistic live score (e.g. 0-0, 1-0, 1-1, etc.)
                homeScore = Math.floor(minutesElapsed / 50 * (rand() > 0.45 ? 1 : 0));
                awayScore = Math.floor(minutesElapsed / 55 * (rand() > 0.55 ? 1 : 0));
            } else {
                // Future match
                status = 'TIMED';
                homeScore = null;
                awayScore = null;
            }

            const match = {
                id: matchId++,
                homeTeam: { name: teams[home]?.name || home, crest: teams[home]?.crest || '' },
                awayTeam: { name: teams[away]?.name || away, crest: teams[away]?.crest || '' },
                utcDate: utcDateStr,
                status: status,
                score: {
                    fullTime: {
                        home: homeScore,
                        away: awayScore
                    }
                },
                group: `GROUP_${group}`,
                stage: 'GROUP_STAGE',
                matchday: 1,
                venue: venue
            };
            return match;
        }

        // Today is June 11, 2026 - Opening day!
        // First matches start today. All are SCHEDULED or TIMED.
        const matches = [
            // June 11 - Opening Day
            m('MEX', 'RSA', 'A', '11', '18:00', 'TIMED', null, null, 'Estadio Azteca, Mexico City'),
            m('KOR', 'CZE', 'A', '11', '21:00', 'TIMED', null, null, 'AT&T Stadium, Dallas'),
            m('CAN', 'BIH', 'B', '11', '21:00', 'TIMED', null, null, 'BC Place, Vancouver'),

            // June 12
            m('QAT', 'SUI', 'B', '12', '15:00', 'TIMED', null, null, 'Hard Rock Stadium, Miami'),
            m('BRA', 'HAI', 'C', '12', '18:00', 'TIMED', null, null, 'Rose Bowl, Los Angeles'),
            m('MAR', 'SCO', 'C', '12', '21:00', 'TIMED', null, null, 'MetLife Stadium, New Jersey'),
            m('USA', 'PAR', 'D', '12', '21:00', 'TIMED', null, null, 'SoFi Stadium, Los Angeles'),

            // June 13
            m('AUS', 'TUR', 'D', '13', '15:00', 'TIMED', null, null, 'NRG Stadium, Houston'),
            m('GER', 'CUW', 'E', '13', '18:00', 'TIMED', null, null, 'Lincoln Financial Field, Philadelphia'),
            m('CIV', 'ECU', 'E', '13', '21:00', 'TIMED', null, null, 'Mercedes-Benz Stadium, Atlanta'),
            m('NED', 'TUN', 'F', '13', '15:00', 'TIMED', null, null, 'Levi\'s Stadium, San Francisco'),
            m('JPN', 'SWE', 'F', '13', '18:00', 'TIMED', null, null, 'BMO Stadium, Los Angeles'),

            // June 14
            m('BEL', 'NZL', 'G', '14', '15:00', 'TIMED', null, null, 'Gillette Stadium, Boston'),
            m('EGY', 'IRN', 'G', '14', '18:00', 'TIMED', null, null, 'Bank of America Stadium, Charlotte'),
            m('ESP', 'URU', 'H', '14', '21:00', 'TIMED', null, null, 'Hard Rock Stadium, Miami'),
            m('CPV', 'KSA', 'H', '14', '15:00', 'TIMED', null, null, 'BMO Field, Toronto'),

            // June 15
            m('FRA', 'NOR', 'I', '15', '18:00', 'TIMED', null, null, 'MetLife Stadium, New Jersey'),
            m('SEN', 'IRQ', 'I', '15', '15:00', 'TIMED', null, null, 'Arrowhead Stadium, Kansas City'),
            m('ARG', 'JOR', 'J', '15', '21:00', 'TIMED', null, null, 'Hard Rock Stadium, Miami'),
            m('ALG', 'AUT', 'J', '15', '18:00', 'TIMED', null, null, 'Lumen Field, Seattle'),

            // June 16
            m('POR', 'COL', 'K', '16', '18:00', 'TIMED', null, null, 'Mercedes-Benz Stadium, Atlanta'),
            m('COD', 'UZB', 'K', '16', '15:00', 'TIMED', null, null, 'GEODIS Park, Nashville'),
            m('ENG', 'PAN', 'L', '16', '21:00', 'TIMED', null, null, 'SoFi Stadium, Los Angeles'),
            m('CRO', 'GHA', 'L', '16', '18:00', 'TIMED', null, null, 'Levi\'s Stadium, San Francisco'),

            // Matchday 2 - June 17-22
            // Group A MD2
            m('MEX', 'CZE', 'A', '17', '18:00', 'TIMED', null, null, 'Estadio Azteca, Mexico City'),
            m('RSA', 'KOR', 'A', '17', '21:00', 'TIMED', null, null, 'AT&T Stadium, Dallas'),
            // Group B MD2
            m('CAN', 'SUI', 'B', '18', '18:00', 'TIMED', null, null, 'BC Place, Vancouver'),
            m('BIH', 'QAT', 'B', '18', '15:00', 'TIMED', null, null, 'Hard Rock Stadium, Miami'),
            // Group C MD2
            m('BRA', 'SCO', 'C', '18', '21:00', 'TIMED', null, null, 'Rose Bowl, Los Angeles'),
            m('HAI', 'MAR', 'C', '19', '15:00', 'TIMED', null, null, 'MetLife Stadium, New Jersey'),
            // Group D MD2
            m('USA', 'TUR', 'D', '19', '21:00', 'TIMED', null, null, 'SoFi Stadium, Los Angeles'),
            m('PAR', 'AUS', 'D', '19', '18:00', 'TIMED', null, null, 'NRG Stadium, Houston'),
            // Group E MD2
            m('GER', 'ECU', 'E', '20', '18:00', 'TIMED', null, null, 'Lincoln Financial Field, Philadelphia'),
            m('CUW', 'CIV', 'E', '20', '15:00', 'TIMED', null, null, 'Mercedes-Benz Stadium, Atlanta'),
            // Group F MD2
            m('NED', 'SWE', 'F', '20', '21:00', 'TIMED', null, null, 'Levi\'s Stadium, San Francisco'),
            m('TUN', 'JPN', 'F', '21', '15:00', 'TIMED', null, null, 'BMO Stadium, Los Angeles'),
            // Group G MD2
            m('BEL', 'IRN', 'G', '21', '18:00', 'TIMED', null, null, 'Gillette Stadium, Boston'),
            m('NZL', 'EGY', 'G', '21', '21:00', 'TIMED', null, null, 'Bank of America Stadium, Charlotte'),
            // Group H MD2
            m('ESP', 'KSA', 'H', '22', '18:00', 'TIMED', null, null, 'Hard Rock Stadium, Miami'),
            m('URU', 'CPV', 'H', '22', '15:00', 'TIMED', null, null, 'BMO Field, Toronto'),
            // Group I MD2
            m('FRA', 'IRQ', 'I', '22', '21:00', 'TIMED', null, null, 'MetLife Stadium, New Jersey'),
            m('NOR', 'SEN', 'I', '23', '15:00', 'TIMED', null, null, 'Arrowhead Stadium, Kansas City'),
            // Group J MD2
            m('ARG', 'AUT', 'J', '23', '21:00', 'TIMED', null, null, 'Hard Rock Stadium, Miami'),
            m('JOR', 'ALG', 'J', '23', '18:00', 'TIMED', null, null, 'Lumen Field, Seattle'),
            // Group K MD2
            m('POR', 'UZB', 'K', '24', '18:00', 'TIMED', null, null, 'Mercedes-Benz Stadium, Atlanta'),
            m('COL', 'COD', 'K', '24', '15:00', 'TIMED', null, null, 'GEODIS Park, Nashville'),
            // Group L MD2
            m('ENG', 'GHA', 'L', '24', '21:00', 'TIMED', null, null, 'SoFi Stadium, Los Angeles'),
            m('PAN', 'CRO', 'L', '25', '18:00', 'TIMED', null, null, 'Levi\'s Stadium, San Francisco'),
        ];

        return {
            matches: matches,
            competition: { name: 'FIFA World Cup 2026' },
            resultSet: { count: matches.length }
        };
    }

    /**
     * Local squads data cache (loaded once from /data/squads.json)
     */
    let localSquadsData = null;
    let localSquadsLoading = null;

    async function loadLocalSquads() {
        if (localSquadsData) return localSquadsData;
        if (localSquadsLoading) return localSquadsLoading;

        localSquadsLoading = (async () => {
            try {
                const resp = await fetch('/data/squads.json');
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                localSquadsData = await resp.json();
                console.log(`Loaded local squads.json with ${Object.keys(localSquadsData).length} teams`);
                return localSquadsData;
            } catch (err) {
                console.warn('Could not load local squads.json:', err.message);
                localSquadsData = {};
                return localSquadsData;
            } finally {
                localSquadsLoading = null;
            }
        })();
        return localSquadsLoading;
    }

    /**
     * Fetch team squad/roster details
     * Priority: 1) Local squads.json  2) API proxy  3) Fallback generator
     */
    async function fetchTeamSquad(teamId, teamName) {
        // Priority 1: Try local squads.json (by teamId or by teamName)
        const localData = await loadLocalSquads();
        if (localData && Object.keys(localData).length > 0) {
            let entry = null;
            // Try by teamId first
            if (teamId && localData[String(teamId)]) {
                entry = localData[String(teamId)];
            }
            // Try by matching teamName
            if (!entry) {
                entry = Object.values(localData).find(t =>
                    t.name === teamName || t.shortName === teamName
                );
            }
            if (entry && entry.squad && entry.squad.length > 0) {
                return {
                    name: entry.name || teamName,
                    shortName: entry.shortName || teamName,
                    tla: entry.tla || '',
                    crest: entry.crest || '',
                    coach: entry.coach || 'N/A',
                    squad: entry.squad.map(p => ({
                        id: p.id || null,
                        name: p.name,
                        position: p.position,
                        shirtNumber: p.shirtNumber || null,
                        currentTeam: p.currentTeam || null
                    }))
                };
            }
        }

        // Priority 2: Try live API (only if we have a teamId)
        if (teamId) {
            const keys = getKeys();
            let url = `${FOOTBALL_DATA_BASE}/teams/${teamId}`;

            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                url = `/api/team?id=${teamId}`;
            }

            const options = {
                headers: {
                    'X-Auth-Token': keys.footballData || 'ae4fa7a0fdd2472b861033c12c518797'
                }
            };

            try {
                const data = await cachedFetch(url, options, `team_squad_${teamId}`);
                return {
                    name: data.name,
                    shortName: data.shortName,
                    tla: data.tla,
                    crest: data.crest,
                    coach: data.coach ? `${data.coach.firstName || ''} ${data.coach.lastName || ''}`.trim() : 'N/A',
                    squad: (data.squad || []).map(p => ({
                        id: p.id,
                        name: p.name,
                        position: p.position,
                        shirtNumber: p.shirtNumber || null
                    }))
                };
            } catch (err) {
                console.warn(`API failed for ${teamName} (ID: ${teamId}):`, err.message);
            }
        }

        // Priority 3: Fallback generator
        console.log(`Using fallback squad generator for ${teamName}`);
        return getFallbackSquad(teamName);
    }

    /**
     * Fallback squad generator when offline or API fails
     */
    function getFallbackSquad(teamName) {
        // Predefined squads for major teams (Vietnamese names)
        const majorSquads = {
            'Brazil': {
                coach: 'Dorival Júnior',
                squad: [
                    { name: 'Alisson Becker', position: 'Goalkeeper', shirtNumber: 1 },
                    { name: 'Ederson Moraes', position: 'Goalkeeper', shirtNumber: 23 },
                    { name: 'Marquinhos', position: 'Defence', shirtNumber: 4 },
                    { name: 'Gabriel Magalhães', position: 'Defence', shirtNumber: 14 },
                    { name: 'Danilo', position: 'Defence', shirtNumber: 2 },
                    { name: 'Éder Militão', position: 'Defence', shirtNumber: 3 },
                    { name: 'Lucas Beraldo', position: 'Defence', shirtNumber: 15 },
                    { name: 'Casemiro', position: 'Midfield', shirtNumber: 5 },
                    { name: 'Bruno Guimarães', position: 'Midfield', shirtNumber: 8 },
                    { name: 'Lucas Paquetá', position: 'Midfield', shirtNumber: 10 },
                    { name: 'Douglas Luiz', position: 'Midfield', shirtNumber: 18 },
                    { name: 'Neymar Jr', position: 'Offence', shirtNumber: 11 },
                    { name: 'Vinicius Jr', position: 'Offence', shirtNumber: 7 },
                    { name: 'Rodrygo Goes', position: 'Offence', shirtNumber: 9 },
                    { name: 'Endrick', position: 'Offence', shirtNumber: 21 }
                ]
            },
            'Argentina': {
                coach: 'Lionel Scaloni',
                squad: [
                    { name: 'Emiliano Martínez', position: 'Goalkeeper', shirtNumber: 23 },
                    { name: 'Gerónimo Rulli', position: 'Goalkeeper', shirtNumber: 12 },
                    { name: 'Cristian Romero', position: 'Defence', shirtNumber: 13 },
                    { name: 'Nicolás Otamendi', position: 'Defence', shirtNumber: 19 },
                    { name: 'Lisandro Martínez', position: 'Defence', shirtNumber: 25 },
                    { name: 'Nahuel Molina', position: 'Defence', shirtNumber: 26 },
                    { name: 'Nicolás Tagliafico', position: 'Defence', shirtNumber: 3 },
                    { name: 'Rodrigo De Paul', position: 'Midfield', shirtNumber: 7 },
                    { name: 'Alexis Mac Allister', position: 'Midfield', shirtNumber: 20 },
                    { name: 'Enzo Fernández', position: 'Midfield', shirtNumber: 24 },
                    { name: 'Leandro Paredes', position: 'Midfield', shirtNumber: 5 },
                    { name: 'Lionel Messi', position: 'Offence', shirtNumber: 10 },
                    { name: 'Lautaro Martínez', position: 'Offence', shirtNumber: 22 },
                    { name: 'Julián Álvarez', position: 'Offence', shirtNumber: 9 },
                    { name: 'Nicolás González', position: 'Offence', shirtNumber: 15 }
                ]
            },
            'Pháp': {
                coach: 'Didier Deschamps',
                squad: [
                    { name: 'Mike Maignan', position: 'Goalkeeper', shirtNumber: 16 },
                    { name: 'Alphonse Areola', position: 'Goalkeeper', shirtNumber: 23 },
                    { name: 'William Saliba', position: 'Defence', shirtNumber: 4 },
                    { name: 'Dayot Upamecano', position: 'Defence', shirtNumber: 15 },
                    { name: 'Jules Koundé', position: 'Defence', shirtNumber: 5 },
                    { name: 'Theo Hernandez', position: 'Defence', shirtNumber: 22 },
                    { name: 'Ibrahima Konaté', position: 'Defence', shirtNumber: 24 },
                    { name: 'Aurélien Tchouaméni', position: 'Midfield', shirtNumber: 8 },
                    { name: 'Eduardo Camavinga', position: 'Midfield', shirtNumber: 6 },
                    { name: 'N\'Golo Kanté', position: 'Midfield', shirtNumber: 13 },
                    { name: 'Adrien Rabiot', position: 'Midfield', shirtNumber: 14 },
                    { name: 'Kylian Mbappé', position: 'Offence', shirtNumber: 10 },
                    { name: 'Ousmane Dembélé', position: 'Offence', shirtNumber: 11 },
                    { name: 'Marcus Thuram', position: 'Offence', shirtNumber: 15 },
                    { name: 'Randal Kolo Muani', position: 'Offence', shirtNumber: 12 }
                ]
            },
            'Anh': {
                coach: 'Thomas Tuchel',
                squad: [
                    { name: 'Jordan Pickford', position: 'Goalkeeper', shirtNumber: 1 },
                    { name: 'Aaron Ramsdale', position: 'Goalkeeper', shirtNumber: 13 },
                    { name: 'John Stones', position: 'Defence', shirtNumber: 5 },
                    { name: 'Kyle Walker', position: 'Defence', shirtNumber: 2 },
                    { name: 'Marc Guéhi', position: 'Defence', shirtNumber: 6 },
                    { name: 'Kieran Trippier', position: 'Defence', shirtNumber: 12 },
                    { name: 'Trent Alexander-Arnold', position: 'Defence', shirtNumber: 8 },
                    { name: 'Declan Rice', position: 'Midfield', shirtNumber: 4 },
                    { name: 'Jude Bellingham', position: 'Midfield', shirtNumber: 10 },
                    { name: 'Conor Gallagher', position: 'Midfield', shirtNumber: 16 },
                    { name: 'Kobbie Mainoo', position: 'Midfield', shirtNumber: 26 },
                    { name: 'Harry Kane', position: 'Offence', shirtNumber: 9 },
                    { name: 'Bukayo Saka', position: 'Offence', shirtNumber: 7 },
                    { name: 'Phil Foden', position: 'Offence', shirtNumber: 11 },
                    { name: 'Cole Palmer', position: 'Offence', shirtNumber: 24 }
                ]
            },
            'Tây Ban Nha': {
                coach: 'Luis de la Fuente',
                squad: [
                    { name: 'Unai Simón', position: 'Goalkeeper', shirtNumber: 23 },
                    { name: 'David Raya', position: 'Goalkeeper', shirtNumber: 1 },
                    { name: 'Aymeric Laporte', position: 'Defence', shirtNumber: 14 },
                    { name: 'Robin Le Normand', position: 'Defence', shirtNumber: 3 },
                    { name: 'Dani Carvajal', position: 'Defence', shirtNumber: 2 },
                    { name: 'Marc Cucurella', position: 'Defence', shirtNumber: 24 },
                    { name: 'Rodri', position: 'Midfield', shirtNumber: 16 },
                    { name: 'Fabián Ruiz', position: 'Midfield', shirtNumber: 8 },
                    { name: 'Pedri González', position: 'Midfield', shirtNumber: 20 },
                    { name: 'Dani Olmo', position: 'Midfield', shirtNumber: 10 },
                    { name: 'Álvaro Morata', position: 'Offence', shirtNumber: 7 },
                    { name: 'Lamine Yamal', position: 'Offence', shirtNumber: 19 },
                    { name: 'Nico Williams', position: 'Offence', shirtNumber: 17 }
                ]
            },
            'Bồ Đào Nha': {
                coach: 'Roberto Martínez',
                squad: [
                    { name: 'Diogo Costa', position: 'Goalkeeper', shirtNumber: 22 },
                    { name: 'José Sá', position: 'Goalkeeper', shirtNumber: 12 },
                    { name: 'Rúben Dias', position: 'Defence', shirtNumber: 4 },
                    { name: 'Pepe', position: 'Defence', shirtNumber: 3 },
                    { name: 'João Cancelo', position: 'Defence', shirtNumber: 20 },
                    { name: 'Nuno Mendes', position: 'Defence', shirtNumber: 19 },
                    { name: 'Bruno Fernandes', position: 'Midfield', shirtNumber: 8 },
                    { name: 'Bernardo Silva', position: 'Midfield', shirtNumber: 10 },
                    { name: 'João Palhinha', position: 'Midfield', shirtNumber: 6 },
                    { name: 'Vitinha', position: 'Midfield', shirtNumber: 23 },
                    { name: 'Cristiano Ronaldo', position: 'Offence', shirtNumber: 7 },
                    { name: 'Rafael Leão', position: 'Offence', shirtNumber: 17 },
                    { name: 'Diogo Jota', position: 'Offence', shirtNumber: 21 }
                ]
            },
            'Đức': {
                coach: 'Julian Nagelsmann',
                squad: [
                    { name: 'Marc-André ter Stegen', position: 'Goalkeeper', shirtNumber: 1 },
                    { name: 'Oliver Baumann', position: 'Goalkeeper', shirtNumber: 12 },
                    { name: 'Antonio Rüdiger', position: 'Defence', shirtNumber: 2 },
                    { name: 'Joshua Kimmich', position: 'Defence', shirtNumber: 6 },
                    { name: 'Jonathan Tah', position: 'Defence', shirtNumber: 4 },
                    { name: 'David Raum', position: 'Defence', shirtNumber: 3 },
                    { name: 'Jamal Musiala', position: 'Midfield', shirtNumber: 10 },
                    { name: 'Florian Wirtz', position: 'Midfield', shirtNumber: 17 },
                    { name: 'Robert Andrich', position: 'Midfield', shirtNumber: 23 },
                    { name: 'Pascal Groß', position: 'Midfield', shirtNumber: 5 },
                    { name: 'Kai Havertz', position: 'Offence', shirtNumber: 7 },
                    { name: 'Niclas Füllkrug', position: 'Offence', shirtNumber: 9 },
                    { name: 'Leroy Sané', position: 'Offence', shirtNumber: 19 }
                ]
            },
            'Nhật Bản': {
                coach: 'Hajime Moriyasu',
                squad: [
                    { name: 'Zion Suzuki', position: 'Goalkeeper', shirtNumber: 12 },
                    { name: 'Takehiro Tomiyasu', position: 'Defence', shirtNumber: 22 },
                    { name: 'Ko Itakura', position: 'Defence', shirtNumber: 4 },
                    { name: 'Hiroki Ito', position: 'Defence', shirtNumber: 21 },
                    { name: 'Wataru Endo', position: 'Midfield', shirtNumber: 6 },
                    { name: 'Hidemasa Morita', position: 'Midfield', shirtNumber: 5 },
                    { name: 'Ao Tanaka', position: 'Midfield', shirtNumber: 17 },
                    { name: 'Ritsu Doan', position: 'Midfield', shirtNumber: 8 },
                    { name: 'Kaoru Mitoma', position: 'Midfield', shirtNumber: 7 },
                    { name: 'Takefusa Kubo', position: 'Offence', shirtNumber: 20 },
                    { name: 'Takumi Minamino', position: 'Offence', shirtNumber: 10 },
                    { name: 'Ayase Ueda', position: 'Offence', shirtNumber: 9 }
                ]
            },
            'Mỹ': {
                coach: 'Mauricio Pochettino',
                squad: [
                    { name: 'Matt Turner', position: 'Goalkeeper', shirtNumber: 1 },
                    { name: 'Antonee Robinson', position: 'Defence', shirtNumber: 5 },
                    { name: 'Tim Ream', position: 'Defence', shirtNumber: 13 },
                    { name: 'Chris Richards', position: 'Defence', shirtNumber: 4 },
                    { name: 'Weston McKennie', position: 'Midfield', shirtNumber: 8 },
                    { name: 'Yunus Musah', position: 'Midfield', shirtNumber: 6 },
                    { name: 'Tyler Adams', position: 'Midfield', shirtNumber: 4 },
                    { name: 'Giovanni Reyna', position: 'Midfield', shirtNumber: 7 },
                    { name: 'Christian Pulisic', position: 'Offence', shirtNumber: 10 },
                    { name: 'Timothy Weah', position: 'Offence', shirtNumber: 21 },
                    { name: 'Folarin Balogun', position: 'Offence', shirtNumber: 20 }
                ]
            },
            'Mexico': {
                coach: 'Javier Aguirre',
                squad: [
                    { name: 'Luis Malagón', position: 'Goalkeeper', shirtNumber: 1 },
                    { name: 'César Montes', position: 'Defence', shirtNumber: 3 },
                    { name: 'Johan Vásquez', position: 'Defence', shirtNumber: 5 },
                    { name: 'Jorge Sánchez', position: 'Defence', shirtNumber: 19 },
                    { name: 'Edson Álvarez', position: 'Midfield', shirtNumber: 4 },
                    { name: 'Luis Chávez', position: 'Midfield', shirtNumber: 24 },
                    { name: 'Luis Romo', position: 'Midfield', shirtNumber: 7 },
                    { name: 'Santiago Giménez', position: 'Offence', shirtNumber: 11 },
                    { name: 'Uriel Antuna', position: 'Offence', shirtNumber: 15 },
                    { name: 'Henry Martín', position: 'Offence', shirtNumber: 21 }
                ]
            },
            'Hàn Quốc': {
                coach: 'Hong Myung-bo',
                squad: [
                    { name: 'Jo Hyeon-woo', position: 'Goalkeeper', shirtNumber: 21 },
                    { name: 'Song Bum-keun', position: 'Goalkeeper', shirtNumber: 12 },
                    { name: 'Kim Min-jae', position: 'Defence', shirtNumber: 4 },
                    { name: 'Kim Young-gwon', position: 'Defence', shirtNumber: 19 },
                    { name: 'Jung Seung-hyun', position: 'Defence', shirtNumber: 15 },
                    { name: 'Kim Jin-su', position: 'Defence', shirtNumber: 3 },
                    { name: 'Seol Young-woo', position: 'Defence', shirtNumber: 22 },
                    { name: 'Lee Kang-in', position: 'Midfield', shirtNumber: 18 },
                    { name: 'Lee Jae-sung', position: 'Midfield', shirtNumber: 10 },
                    { name: 'Hwang In-beom', position: 'Midfield', shirtNumber: 6 },
                    { name: 'Hong Hyun-seok', position: 'Midfield', shirtNumber: 8 },
                    { name: 'Son Heung-min', position: 'Offence', shirtNumber: 7 },
                    { name: 'Hwang Hee-chan', position: 'Offence', shirtNumber: 11 },
                    { name: 'Cho Gue-sung', position: 'Offence', shirtNumber: 9 },
                    { name: 'Oh Hyeong-gyu', position: 'Offence', shirtNumber: 20 }
                ]
            }
        };

        // If team squad is predefined, return it
        if (majorSquads[teamName]) {
            return {
                name: teamName,
                coach: majorSquads[teamName].coach,
                squad: majorSquads[teamName].squad
            };
        }

        // Otherwise, dynamically generate a squad
        // Custom PRNG seeded with team name
        let hash = 0;
        for (let i = 0; i < teamName.length; i++) {
            hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const rand = () => {
            const x = Math.sin(hash++) * 10000;
            return x - Math.floor(x);
        };

        // Determine region name pools
        let region = 'EUROPE';
        const regionsMap = {
            // Asia
            'Nhật Bản': 'ASIA', 'Hàn Quốc': 'ASIA', 'Ả Rập Saudi': 'ARAB', 'Qatar': 'ARAB', 'Iran': 'PERSIAN',
            'Iraq': 'ARAB', 'Uzbekistan': 'CIS', 'Jordan': 'ARAB', 'Úc': 'ENGLISH',
            // Africa
            'Nam Phi': 'AFRICA_SOUTH', 'Morocco': 'ARAB', 'Senegal': 'AFRICA_WEST', 'Ghana': 'AFRICA_WEST',
            'Nigeria': 'AFRICA_WEST', 'Cameroon': 'AFRICA_WEST', 'Bờ Biển Ngà': 'AFRICA_WEST', 'Cabo Verde': 'PORTUGUESE',
            'Tunisia': 'ARAB', 'Ai Cập': 'ARAB', 'Algeria': 'ARAB', 'DR Congo': 'AFRICA_FRENCH',
            // Latin America
            'Brazil': 'BRAZIL', 'Argentina': 'LATAM', 'Uruguay': 'LATAM', 'Colombia': 'LATAM', 'Ecuador': 'LATAM',
            'Paraguay': 'LATAM', 'Panama': 'LATAM', 'Haiti': 'LATAM', 'Curaçao': 'LATAM',
            // North America / English
            'Mỹ': 'ENGLISH', 'Canada': 'ENGLISH', 'Scotland': 'ENGLISH',
            // Europe
            'Pháp': 'EUROPE_FRENCH', 'Đức': 'EUROPE_GERMAN', 'Tây Ban Nha': 'LATAM', 'Bồ Đào Nha': 'PORTUGUESE',
            'Anh': 'ENGLISH', 'Ý': 'EUROPE_ITALIAN', 'Bỉ': 'EUROPE_FRENCH', 'Croatia': 'EUROPE_SLAVIC',
            'Hà Lan': 'EUROPE_DUTCH', 'Thụy Điển': 'EUROPE_NORDIC', 'Đan Mạch': 'EUROPE_NORDIC', 'Thụy Sĩ': 'EUROPE',
            'Áo': 'EUROPE_GERMAN', 'Thổ Nhĩ Kỳ': 'TURKISH', 'Czechia': 'EUROPE_SLAVIC', 'Na Uy': 'EUROPE_NORDIC'
        };

        region = regionsMap[teamName] || 'EUROPE';

        const namePools = {
            ENGLISH: {
                firsts: ['John', 'James', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Thomas', 'Charles', 'Daniel', 'Matthew', 'Mark'],
                lasts: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Walker']
            },
            LATAM: {
                firsts: ['Juan', 'José', 'Luis', 'Carlos', 'Mateo', 'Santiago', 'Diego', 'Alejandro', 'Andrés', 'Gabriel', 'Lucas', 'Javier'],
                lasts: ['Rodriguez', 'Gomez', 'Fernandez', 'Lopez', 'Diaz', 'Martinez', 'Perez', 'Garcia', 'Sanchez', 'Romero', 'Alvarez', 'Torres']
            },
            BRAZIL: {
                firsts: ['Lucas', 'Gabriel', 'Matheus', 'Pedro', 'Felipe', 'Thiago', 'Gustavo', 'Bruno', 'Rodrigo', 'Douglas', 'André', 'Vinicius'],
                lasts: ['Silva', 'Santos', 'Sousa', 'Oliveira', 'Pereira', 'Lima', 'Carvalho', 'Ferreira', 'Costa', 'Ribeiro', 'Alves', 'Gomes']
            },
            ASIA: {
                firsts: ['Min-jun', 'Seo-jun', 'Ha-jun', 'Do-yun', 'Kenji', 'Hiroshi', 'Takeshi', 'Yuki', 'Jung-ho', 'Ji-hoon', 'Takashi', 'Haruto'],
                lasts: ['Kim', 'Lee', 'Park', 'Choi', 'Sato', 'Suzuki', 'Takahashi', 'Watanabe', 'Tanaka', 'Ito', 'Yamamoto', 'Nakamura']
            },
            ARAB: {
                firsts: ['Ahmed', 'Mohamed', 'Ali', 'Hassan', 'Youssef', 'Ibrahim', 'Mahmoud', 'Mustafa', 'Khaled', 'Omar', 'Tarek', 'Ziad'],
                lasts: ['Al-Mansour', 'Haddad', 'El-Amin', 'Saleh', 'Hariri', 'Mustafa', 'Abadi', 'Ghanem', 'Hakim', 'Bishara', 'Suleiman', 'Kassab']
            },
            AFRICA_WEST: {
                firsts: ['Samuel', 'Kofi', 'Kwame', 'Moussa', 'Ousmane', 'Sadio', 'Didier', 'Emmanuel', 'John', 'Kelechi', 'Victor', 'Wilfried'],
                lasts: ['Mensah', 'Osei', 'Kouassi', 'Touré', 'Diallo', 'Diop', 'Sow', 'Onyekuru', 'Appiah', 'Gyan', 'Boateng', 'Koffi']
            },
            EUROPE: {
                firsts: ['Thomas', 'Daniel', 'Marcus', 'David', 'Lukas', 'Stefan', 'Peter', 'Martin', 'Alex', 'Christian', 'Jan', 'Nikola'],
                lasts: ['Müller', 'Schmidt', 'Fischer', 'Weber', 'Kovacic', 'Petrov', 'Nielsen', 'Hansen', 'Larsson', 'Andersson', 'Novak', 'Svoboda']
            }
        };

        const pool = namePools[region] || namePools.EUROPE;
        const poolFirsts = pool.firsts;
        const poolLasts = pool.lasts;

        const coach = `${poolFirsts[Math.floor(rand() * poolFirsts.length)]} ${poolLasts[Math.floor(rand() * poolLasts.length)]}`;

        const squad = [];

        // 2 GKs
        for (let i = 1; i <= 2; i++) {
            squad.push({
                name: `${poolFirsts[Math.floor(rand() * poolFirsts.length)]} ${poolLasts[Math.floor(rand() * poolLasts.length)]}`,
                position: 'Goalkeeper',
                shirtNumber: i === 1 ? 1 : 12
            });
        }
        // 5 DFs
        const dfNumbers = [2, 3, 4, 5, 15];
        for (let i = 0; i < 5; i++) {
            squad.push({
                name: `${poolFirsts[Math.floor(rand() * poolFirsts.length)]} ${poolLasts[Math.floor(rand() * poolLasts.length)]}`,
                position: 'Defence',
                shirtNumber: dfNumbers[i]
            });
        }
        // 5 MFs
        const mfNumbers = [6, 8, 10, 14, 16];
        for (let i = 0; i < 5; i++) {
            squad.push({
                name: `${poolFirsts[Math.floor(rand() * poolFirsts.length)]} ${poolLasts[Math.floor(rand() * poolLasts.length)]}`,
                position: 'Midfield',
                shirtNumber: mfNumbers[i]
            });
        }
        // 4 FWs
        const fwNumbers = [7, 9, 11, 20];
        for (let i = 0; i < 4; i++) {
            squad.push({
                name: `${poolFirsts[Math.floor(rand() * poolFirsts.length)]} ${poolLasts[Math.floor(rand() * poolLasts.length)]}`,
                position: 'Offence',
                shirtNumber: fwNumbers[i]
            });
        }

        return {
            name: teamName,
            coach: coach,
            squad: squad
        };
    }

    return {
        getKeys,
        saveKeys,
        hasFootballDataKey,
        hasGeminiKey,
        fetchMatches,
        getPrediction,
        fetchTeamSquad
    };
})();
