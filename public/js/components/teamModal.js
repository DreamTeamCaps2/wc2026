/**
 * Team Modal Component - Fetches and displays team squad/roster.
 */

const TeamModal = (() => {
    const modalOverlay = () => document.getElementById('team-modal');
    const modalBody = () => document.getElementById('team-body');
    const closeBtn = () => document.getElementById('team-close');

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
     * Open modal and fetch/render squad data
     */
    async function open(teamId, teamName) {
        const modal = modalOverlay();
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Show loading state
        renderLoading(teamName);

        try {
            const squadData = await API.fetchTeamSquad(teamId, teamName);
            renderSquad(squadData);
        } catch (err) {
            renderError(err.message || 'Không thể tải đội hình.');
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
    function renderLoading(teamName) {
        modalBody().innerHTML = `
            <div class="team-modal-header">
                <h2 class="modal-title">📋 Đội Hình Đội Tuyển</h2>
                <div class="team-modal-subtitle">${escapeHtml(teamName)}</div>
            </div>
            <div class="team-loading">
                <div class="loader-spinner"></div>
                <p>Đang tải thông tin đội hình...</p>
            </div>
        `;
    }

    /**
     * Render error state
     */
    function renderError(message) {
        modalBody().innerHTML = `
            <div class="team-error">
                <div class="error-icon">❌</div>
                <p>Không thể tải thông tin đội hình</p>
                <div class="error-detail">${escapeHtml(message)}</div>
            </div>
        `;
    }

    /**
     * Render the squad divided by positions
     */
    function renderSquad(data) {
        const { name, coach, squad } = data;

        // Group players by position
        const positions = {
            Goalkeeper: [],
            Defence: [],
            Midfield: [],
            Offence: []
        };

        (squad || []).forEach(player => {
            let pos = player.position;
            // Normalize positions from API
            if (pos === 'Goalkeeper' || pos === 'GK') positions.Goalkeeper.push(player);
            else if (pos === 'Defender' || pos === 'Defence' || pos === 'DF') positions.Defence.push(player);
            else if (pos === 'Midfielder' || pos === 'Midfield' || pos === 'MF') positions.Midfield.push(player);
            else if (pos === 'Forward' || pos === 'Offence' || pos === 'FW' || pos === 'Striker') positions.Offence.push(player);
            else positions.Midfield.push(player); // Fallback
        });

        // Translate headers
        const positionHeaders = {
            Goalkeeper: '🧤 Thủ Môn',
            Defence: '🛡️ Hậu Vệ',
            Midfield: '⚙️ Tiền Vệ',
            Offence: '🔥 Tiền Đạo'
        };

        let sectionsHTML = '';

        for (const [key, players] of Object.entries(positions)) {
            if (players.length === 0) continue;

            // Sort players by shirt number
            players.sort((a, b) => (a.shirtNumber || 99) - (b.shirtNumber || 99));

            const playersHTML = players.map(p => {
                let clubHTML = '';
                if (p.currentTeam) {
                    const clubName = p.currentTeam.shortName || p.currentTeam.name;
                    const clubCrest = p.currentTeam.crest;
                    const clubCountry = p.currentTeam.country;
                    clubHTML = `
                        <div class="player-club" title="${escapeHtml(p.currentTeam.name)}${clubCountry ? ` (${escapeHtml(clubCountry)})` : ''}">
                            ${clubCrest ? `<img class="player-club-crest" src="${escapeHtml(clubCrest)}" alt="${escapeHtml(clubName)}" onerror="this.style.display='none'"/>` : ''}
                            <span class="player-club-name">${escapeHtml(clubName)}</span>
                        </div>
                    `;
                }
                return `
                    <div class="player-card">
                        <div class="player-number-badge">
                            ${p.shirtNumber !== null && p.shirtNumber !== undefined ? p.shirtNumber : '#'}
                        </div>
                        <div class="player-info">
                            <span class="player-name">${escapeHtml(p.name)}</span>
                            ${clubHTML}
                        </div>
                    </div>
                `;
            }).join('');

            sectionsHTML += `
                <div class="squad-position-section">
                    <h3 class="position-header">${positionHeaders[key]}</h3>
                    <div class="player-grid">
                        ${playersHTML}
                    </div>
                </div>
            `;
        }

        modalBody().innerHTML = `
            <div class="team-modal-header">
                <h2 class="modal-title">📋 Đội Hình Đội Tuyển</h2>
                <div class="team-modal-subtitle">${escapeHtml(name)}</div>
                <div class="team-coach-card">
                    <span class="coach-label">👔 Huấn luyện viên trưởng:</span>
                    <span class="coach-name">${escapeHtml(coach || 'Chưa cập nhật')}</span>
                </div>
            </div>
            <div class="squad-container">
                ${sectionsHTML || '<div class="no-squad">Không có thông tin danh sách cầu thủ.</div>'}
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
