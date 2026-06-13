/**
 * Main Application - WC 2026 Match Tracker
 * Entry point that orchestrates all components.
 */

(function App() {
    'use strict';

    let allMatches = [];
    let currentFilters = { status: 'all', group: 'all', search: '' };

    /**
     * Initialize the application
     */
    async function init() {
        // Init components
        PredictionModal.init();
        TeamModal.init();
        FilterBar.init(handleFilterChange);
        initSettings();

        // Load matches
        await loadMatches();

        // Set up event delegation for predict buttons
        document.getElementById('matches-container').addEventListener('click', handleMatchClick);

        // Auto-refresh every 5 minutes
        setInterval(loadMatches, 5 * 60 * 1000);
    }

    /**
     * Load matches from API or demo data
     */
    async function loadMatches() {
        try {
            showLoading(true);
            const data = await API.fetchMatches();

            // Normalize data structure (API vs demo)
            allMatches = (data.matches || []).map(normalizeMatch);

            // Sort by date
            allMatches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

            // Update stats
            updateStats();

            // Update countdown
            updateCountdown();

            // Render matches
            renderMatches();

            showLoading(false);
        } catch (err) {
            console.error('Failed to load matches:', err);
            showLoading(false);
            showError('Không thể tải dữ liệu trận đấu. Vui lòng thử lại sau.');
        }
    }

    /**
     * Normalize match object from different data sources
     */
    function normalizeMatch(match) {
        return {
            id: match.id,
            homeTeam: {
                name: match.homeTeam?.name || match.homeTeam?.shortName || 'TBD',
                crest: match.homeTeam?.crest || ''
            },
            awayTeam: {
                name: match.awayTeam?.name || match.awayTeam?.shortName || 'TBD',
                crest: match.awayTeam?.crest || ''
            },
            utcDate: match.utcDate,
            status: match.status || 'TIMED',
            score: {
                fullTime: {
                    home: match.score?.fullTime?.home ?? null,
                    away: match.score?.fullTime?.away ?? null
                }
            },
            group: match.group || null,
            stage: match.stage || 'GROUP_STAGE',
            matchday: match.matchday || 1,
            venue: match.venue || ''
        };
    }

    /**
     * Render matches with current filters
     */
    function renderMatches() {
        const container = document.getElementById('matches-container');
        const filtered = FilterBar.applyFilters(allMatches, currentFilters);

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <p>Không tìm thấy trận đấu nào</p>
                    <p class="no-results-hint">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                </div>
            `;
            return;
        }

        // Group by date
        const dateGroups = MatchCard.groupByDate(filtered);

        container.innerHTML = '';

        dateGroups.forEach((group, idx) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'match-day-group';
            groupEl.style.animationDelay = `${idx * 0.1}s`;

            // Day header
            const headerEl = document.createElement('div');
            headerEl.className = 'match-day-header';
            headerEl.innerHTML = `
                <span class="match-day-date">📅 ${group.dateStr}</span>
                <span class="match-day-count">${group.matches.length} trận</span>
                <div class="match-day-line"></div>
            `;
            groupEl.appendChild(headerEl);

            // Match grid
            const gridEl = document.createElement('div');
            gridEl.className = 'match-grid';

            group.matches.forEach(match => {
                const card = MatchCard.render(match);
                gridEl.appendChild(card);
            });

            groupEl.appendChild(gridEl);
            container.appendChild(groupEl);
        });
    }

    /**
     * Handle click events on match cards (event delegation)
     */
    function handleMatchClick(e) {
        // Handle Predict Button Click
        const predictBtn = e.target.closest('.btn-predict');
        if (predictBtn) {
            const matchId = parseInt(predictBtn.getAttribute('data-match-id'));
            const match = allMatches.find(m => m.id === matchId);
            if (match) {
                PredictionModal.open(match);
            }
            return;
        }

        // Handle Team Info Button Click
        const teamInfoBtn = e.target.closest('.btn-team-info');
        if (teamInfoBtn) {
            const teamId = teamInfoBtn.getAttribute('data-team-id');
            const teamName = teamInfoBtn.getAttribute('data-team-name');
            TeamModal.open(teamId ? parseInt(teamId) : null, teamName);
            return;
        }
    }

    /**
     * Handle filter changes
     */
    function handleFilterChange(filters) {
        currentFilters = filters;
        renderMatches();
    }

    /**
     * Update stats bar
     */
    function updateStats() {
        const total = allMatches.length;
        const finished = allMatches.filter(m =>
            MatchCard.getStatusCategory(m.status) === 'finished'
        ).length;
        const live = allMatches.filter(m =>
            MatchCard.getStatusCategory(m.status) === 'live'
        ).length;
        const upcoming = allMatches.filter(m =>
            MatchCard.getStatusCategory(m.status) === 'scheduled'
        ).length;

        animateNumber('stat-total', total);
        animateNumber('stat-finished', finished);
        animateNumber('stat-live', live);
        animateNumber('stat-upcoming', upcoming);
    }

    /**
     * Animate a number counting up
     */
    function animateNumber(elementId, target) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const duration = 600;
        const start = parseInt(el.textContent) || 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.round(start + (target - start) * eased);
            el.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    /**
     * Update countdown / next match info
     */
    function updateCountdown() {
        const now = new Date();
        const nextMatch = allMatches.find(m => {
            const matchDate = new Date(m.utcDate);
            return matchDate > now && MatchCard.getStatusCategory(m.status) === 'scheduled';
        });

        const infoEl = document.getElementById('next-match-info');
        const labelEl = document.querySelector('.countdown-label');

        // Check if any match is live
        const liveMatch = allMatches.find(m =>
            MatchCard.getStatusCategory(m.status) === 'live'
        );

        if (liveMatch) {
            labelEl.textContent = '🔴 ĐANG DIỄN RA';
            labelEl.style.color = 'var(--accent-red)';
            infoEl.textContent = `${liveMatch.homeTeam.name} vs ${liveMatch.awayTeam.name}`;
        } else if (nextMatch) {
            const matchDate = new Date(nextMatch.utcDate);
            const diff = matchDate - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            labelEl.textContent = '⏳ TRẬN TIẾP THEO';
            labelEl.style.color = 'var(--accent-amber)';

            if (hours > 24) {
                const days = Math.floor(hours / 24);
                infoEl.textContent = `${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name} • ${days} ngày nữa`;
            } else {
                infoEl.textContent = `${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name} • ${hours}h ${minutes}m`;
            }
        } else {
            labelEl.textContent = '🏆 GIẢI ĐẤU';
            labelEl.style.color = 'var(--accent-green)';
            infoEl.textContent = 'FIFA World Cup 2026';
        }
    }

    /**
     * Show/hide loading skeleton
     */
    function showLoading(show) {
        const skeleton = document.getElementById('loading-skeleton');
        if (skeleton) {
            skeleton.style.display = show ? 'grid' : 'none';
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        const container = document.getElementById('matches-container');
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">⚠️</div>
                <p>${message}</p>
                <p class="no-results-hint">Kiểm tra API key trong ⚙️ Cài Đặt</p>
            </div>
        `;
    }

    /**
     * Initialize settings modal
     */
    function initSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        const settingsClose = document.getElementById('settings-close');
        const saveBtn = document.getElementById('save-settings');
        const fdInput = document.getElementById('fd-api-key');
        const geminiInput = document.getElementById('gemini-api-key');

        // Load saved keys
        const keys = API.getKeys();
        if (keys.footballData) fdInput.value = keys.footballData;
        if (keys.gemini) geminiInput.value = keys.gemini;

        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
        });

        settingsClose.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.style.display = 'none';
        });

        saveBtn.addEventListener('click', () => {
            API.saveKeys(fdInput.value.trim(), geminiInput.value.trim());
            settingsModal.style.display = 'none';

            // Reload matches if football data key was added
            if (fdInput.value.trim()) {
                loadMatches();
            }

            // Visual feedback
            saveBtn.textContent = '✅ Đã lưu!';
            setTimeout(() => {
                saveBtn.textContent = '💾 Lưu Cài Đặt';
            }, 2000);
        });

        // Show settings on first visit if no keys
        if (!keys.footballData && !keys.gemini) {
            // Don't auto-show - let user discover the settings button
        }
    }

    // Start the app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
