/**
 * Match Card Component - Renders individual match cards.
 */

const MatchCard = (() => {
    /**
     * Determine match status category
     */
    function getStatusCategory(status) {
        const finished = ['FINISHED', 'AWARDED'];
        const live = ['IN_PLAY', 'PAUSED', 'HALFTIME', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'];
        const scheduled = ['TIMED', 'SCHEDULED'];

        if (finished.includes(status)) return 'finished';
        if (live.includes(status)) return 'live';
        if (scheduled.includes(status)) return 'scheduled';
        return 'scheduled';
    }

    /**
     * Get status display text in Vietnamese
     */
    function getStatusText(status) {
        const map = {
            FINISHED: 'Kết thúc',
            AWARDED: 'Kết thúc',
            IN_PLAY: '🔴 Đang đấu',
            PAUSED: '⏸ Tạm dừng',
            HALFTIME: 'Nghỉ giữa hiệp',
            EXTRA_TIME: 'Hiệp phụ',
            PENALTY_SHOOTOUT: 'Luân lưu',
            TIMED: 'Sắp đấu',
            SCHEDULED: 'Sắp đấu',
            POSTPONED: 'Hoãn',
            CANCELLED: 'Hủy',
            SUSPENDED: 'Tạm hoãn'
        };
        return map[status] || status;
    }

    /**
     * Format group name
     */
    function formatGroup(group) {
        if (!group) return '';
        return group.replace('GROUP_', 'Bảng ');
    }

    /**
     * Format stage name
     */
    function formatStage(stage) {
        const map = {
            'GROUP_STAGE': 'Vòng bảng',
            'ROUND_OF_32': 'Vòng 32',
            'ROUND_OF_16': 'Vòng 16',
            'QUARTER_FINALS': 'Tứ kết',
            'SEMI_FINALS': 'Bán kết',
            'THIRD_PLACE': 'Tranh hạng 3',
            'FINAL': 'Chung kết'
        };
        return map[stage] || stage;
    }

    /**
     * Format match time from UTC date
     */
    function formatTime(utcDate) {
        const date = new Date(utcDate);
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    /**
     * Format date in Vietnamese
     */
    function formatDate(utcDate) {
        const date = new Date(utcDate);
        return date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Handle image load error - show placeholder
     */
    function handleCrestError(img) {
        img.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'team-crest-placeholder';
        placeholder.style.cssText = `
            width: 48px; height: 48px; border-radius: 8px;
            background: rgba(124,58,237,0.15); display: flex;
            align-items: center; justify-content: center;
            font-size: 1.2rem; color: var(--text-muted);
        `;
        placeholder.textContent = '🏳️';
        img.parentNode.insertBefore(placeholder, img);
    }

    /**
     * Render a single match card
     */
    function render(match) {
        const statusCat = getStatusCategory(match.status);
        const statusText = getStatusText(match.status);
        const homeScore = match.score?.fullTime?.home;
        const awayScore = match.score?.fullTime?.away;
        const hasScore = homeScore !== null && awayScore !== null;
        const groupText = formatGroup(match.group);
        const stageText = formatStage(match.stage);
        const time = formatTime(match.utcDate);

        const card = document.createElement('div');
        card.className = `match-card ${statusCat === 'live' ? 'live' : ''}`;
        card.setAttribute('data-match-id', match.id);
        card.setAttribute('data-group', match.group || '');
        card.setAttribute('data-status', statusCat);

        card.innerHTML = `
            <div class="card-header">
                <span class="card-stage">${groupText ? groupText + ' • ' : ''}${stageText}</span>
                <span class="card-status ${statusCat}">${statusText}</span>
            </div>
            <div class="card-matchup">
                <div class="team-block">
                    <img class="team-crest"
                         src="${match.homeTeam.crest || ''}"
                         alt="${match.homeTeam.name}"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                         loading="lazy">
                    <div class="team-crest-placeholder" style="display:none;width:48px;height:48px;border-radius:8px;background:rgba(124,58,237,0.15);align-items:center;justify-content:center;font-size:1.2rem;">🏳️</div>
                    <div class="team-name-container">
                        <span class="team-name">${match.homeTeam.name}</span>
                        <button class="btn-team-info" data-team-id="${match.homeTeam.id || ''}" data-team-name="${match.homeTeam.name}" title="Xem đội hình">ℹ️</button>
                    </div>
                </div>
                <div class="score-area">
                    ${hasScore
                        ? `<span class="score-display has-score">${homeScore} <span class="score-separator">-</span> ${awayScore}</span>`
                        : `<span class="score-vs">VS</span>
                           <span class="score-time">${time}</span>`
                    }
                </div>
                <div class="team-block">
                    <img class="team-crest"
                         src="${match.awayTeam.crest || ''}"
                         alt="${match.awayTeam.name}"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                         loading="lazy">
                    <div class="team-crest-placeholder" style="display:none;width:48px;height:48px;border-radius:8px;background:rgba(124,58,237,0.15);align-items:center;justify-content:center;font-size:1.2rem;">🏳️</div>
                    <div class="team-name-container">
                        <span class="team-name">${match.awayTeam.name}</span>
                        <button class="btn-team-info" data-team-id="${match.awayTeam.id || ''}" data-team-name="${match.awayTeam.name}" title="Xem đội hình">ℹ️</button>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <span class="card-venue">📍 ${match.venue || ''}</span>
                ${statusCat === 'scheduled'
                    ? `<button class="btn-predict" data-match-id="${match.id}" id="predict-btn-${match.id}">
                        🔮 Dự đoán
                       </button>`
                    : ''
                }
            </div>
        `;

        return card;
    }

    /**
     * Group matches by date
     */
    function groupByDate(matches) {
        const groups = {};
        matches.forEach(match => {
            const date = new Date(match.utcDate);
            // Use local date for grouping (consistent with formatDate display)
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const dateKey = `${y}-${m}-${d}`;
            if (!groups[dateKey]) {
                groups[dateKey] = {
                    dateStr: formatDate(match.utcDate),
                    matches: []
                };
            }
            groups[dateKey].matches.push(match);
        });

        // Sort by date
        const sorted = Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b));

        return sorted.map(([key, val]) => val);
    }

    return { render, groupByDate, getStatusCategory, formatDate };
})();
