/**
 * Prediction Modal Component - Shows AI prediction results.
 */

const PredictionModal = (() => {
    const modalOverlay = () => document.getElementById('prediction-modal');
    const modalBody = () => document.getElementById('prediction-body');
    const closeBtn = () => document.getElementById('prediction-close');

    /**
     * Initialize modal event listeners
     */
    function init() {
        closeBtn().addEventListener('click', close);
        modalOverlay().addEventListener('click', (e) => {
            if (e.target === modalOverlay()) close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });
    }

    /**
     * Open modal and show loading, then fetch prediction
     */
    async function open(match) {
        const modal = modalOverlay();
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Show loading state
        renderLoading(match);

        try {
            const prediction = await API.getPrediction(
                match.homeTeam.name,
                match.awayTeam.name,
                match.group ? match.group.replace('GROUP_', 'Bảng ') : '',
                new Date(match.utcDate).toLocaleDateString('vi-VN')
            );

            renderPrediction(match, prediction);
        } catch (err) {
            renderError(err.message);
        }
    }

    /**
     * Close modal
     */
    function close() {
        const modal = modalOverlay();
        modal.style.display = 'none';
        document.body.style.overflow = '';
        modalBody().innerHTML = '';
    }

    /**
     * Render loading state
     */
    function renderLoading(match) {
        modalBody().innerHTML = `
            <div class="prediction-header">
                <h2 class="modal-title">🔮 Dự Đoán Trận Đấu</h2>
                <div class="prediction-teams">
                    <div class="prediction-team">
                        <img src="${match.homeTeam.crest || ''}"
                             alt="${match.homeTeam.name}"
                             onerror="this.style.display='none';">
                        <span class="prediction-team-name">${match.homeTeam.name}</span>
                    </div>
                    <span class="prediction-vs">VS</span>
                    <div class="prediction-team">
                        <img src="${match.awayTeam.crest || ''}"
                             alt="${match.awayTeam.name}"
                             onerror="this.style.display='none';">
                        <span class="prediction-team-name">${match.awayTeam.name}</span>
                    </div>
                </div>
            </div>
            <div class="prediction-loading">
                <div class="loader-spinner"></div>
                <p>🧠 AI đang phân tích trận đấu...</p>
                <p class="loader-sub">Tổng hợp dữ liệu từ 5 nguồn phân tích uy tín</p>
            </div>
        `;
    }

    /**
     * Render prediction results
     */
    function renderPrediction(match, prediction) {
        const { predictedScore, confidence, analysis } = prediction;

        // Build sources HTML
        let sourcesHTML = '';
        if (analysis?.sources && Array.isArray(analysis.sources)) {
            sourcesHTML = analysis.sources.map(src => `
                <div class="source-item">
                    <span class="source-name">${escapeHtml(src.name)}</span>
                    <span class="source-score">${escapeHtml(src.prediction)}</span>
                    <span class="source-note">${escapeHtml(src.note)}</span>
                </div>
            `).join('');
        }

        // Build key factors HTML
        let factorsHTML = '';
        if (analysis?.keyFactors && Array.isArray(analysis.keyFactors)) {
            factorsHTML = analysis.keyFactors.map(f =>
                `<span class="factor-tag">${escapeHtml(f)}</span>`
            ).join('');
        }

        modalBody().innerHTML = `
            <div class="prediction-header">
                <h2 class="modal-title">🔮 Dự Đoán Trận Đấu</h2>
                <div class="prediction-teams">
                    <div class="prediction-team">
                        <img src="${match.homeTeam.crest || ''}"
                             alt="${match.homeTeam.name}"
                             onerror="this.style.display='none';">
                        <span class="prediction-team-name">${match.homeTeam.name}</span>
                    </div>
                    <span class="prediction-vs">VS</span>
                    <div class="prediction-team">
                        <img src="${match.awayTeam.crest || ''}"
                             alt="${match.awayTeam.name}"
                             onerror="this.style.display='none';">
                        <span class="prediction-team-name">${match.awayTeam.name}</span>
                    </div>
                </div>
            </div>

            <div class="prediction-score-section">
                <div class="prediction-score-label">Tỉ số dự đoán</div>
                <div class="prediction-score">
                    ${predictedScore?.home ?? '?'} - ${predictedScore?.away ?? '?'}
                </div>
                <div class="confidence-meter">
                    <div class="confidence-bar-bg">
                        <div class="confidence-bar-fill" style="width: 0%;" id="confidence-fill"></div>
                    </div>
                    <span class="confidence-value">${confidence ?? '?'}%</span>
                </div>
                <div class="prediction-score-label" style="margin-top:4px;">Độ tin cậy</div>
            </div>

            <div class="prediction-analysis">
                ${analysis?.summary ? `
                    <div class="analysis-summary">
                        📊 ${escapeHtml(analysis.summary)}
                    </div>
                ` : ''}

                ${sourcesHTML ? `
                    <div class="sources-title">📰 Phân tích từ 5 nguồn</div>
                    <div class="sources-list">
                        ${sourcesHTML}
                    </div>
                ` : ''}

                ${analysis?.homeTeamStrength || analysis?.awayTeamStrength ? `
                    <div class="sources-title">💪 Điểm mạnh</div>
                    <div class="sources-list" style="margin-bottom: 20px;">
                        ${analysis.homeTeamStrength ? `
                            <div class="source-item">
                                <span class="source-name">${match.homeTeam.name}</span>
                                <span class="source-note">${escapeHtml(analysis.homeTeamStrength)}</span>
                            </div>
                        ` : ''}
                        ${analysis.awayTeamStrength ? `
                            <div class="source-item">
                                <span class="source-name">${match.awayTeam.name}</span>
                                <span class="source-note">${escapeHtml(analysis.awayTeamStrength)}</span>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${factorsHTML ? `
                    <div class="sources-title">🔑 Yếu tố then chốt</div>
                    <div class="key-factors">
                        ${factorsHTML}
                    </div>
                ` : ''}
            </div>
        `;

        // Animate confidence bar
        requestAnimationFrame(() => {
            const fill = document.getElementById('confidence-fill');
            if (fill && confidence) {
                fill.style.width = `${confidence}%`;
            }
        });
    }

    /**
     * Render error state
     */
    function renderError(message) {
        modalBody().innerHTML = `
            <div class="prediction-error">
                <div class="error-icon">❌</div>
                <p>Không thể tạo dự đoán</p>
                <div class="error-detail">${escapeHtml(message)}</div>
            </div>
        `;
    }

    /**
     * Escape HTML entities
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return { init, open, close };
})();
