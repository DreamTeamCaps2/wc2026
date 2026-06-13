/**
 * Filter Bar Component - Handles filtering and searching matches.
 */

const FilterBar = (() => {
    let currentStatusFilter = 'all';
    let currentGroupFilter = 'all';
    let currentSearchQuery = '';
    let onFilterChange = null;

    /**
     * Initialize filter bar event listeners
     */
    function init(callback) {
        onFilterChange = callback;

        // Status filter chips
        document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                const filter = chip.getAttribute('data-filter');
                if (filter === 'all') {
                    currentStatusFilter = 'all';
                } else if (filter.startsWith('status-')) {
                    currentStatusFilter = filter.replace('status-', '');
                }

                triggerFilter();
            });
        });

        // Group select
        const groupSelect = document.getElementById('group-filter');
        groupSelect.addEventListener('change', () => {
            currentGroupFilter = groupSelect.value;
            triggerFilter();
        });

        // Search input with debounce
        const searchInput = document.getElementById('search-input');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearchQuery = searchInput.value.trim().toLowerCase();
                triggerFilter();
            }, 250);
        });
    }

    /**
     * Trigger filter callback
     */
    function triggerFilter() {
        if (onFilterChange) {
            onFilterChange({
                status: currentStatusFilter,
                group: currentGroupFilter,
                search: currentSearchQuery
            });
        }
    }

    /**
     * Apply filters to matches array
     */
    function applyFilters(matches, filters) {
        return matches.filter(match => {
            // Status filter
            if (filters.status !== 'all') {
                const statusCat = MatchCard.getStatusCategory(match.status);
                if (statusCat !== filters.status) return false;
            }

            // Group filter
            if (filters.group !== 'all') {
                if (match.group !== filters.group) return false;
            }

            // Search filter
            if (filters.search) {
                const query = filters.search;
                const homeName = match.homeTeam.name.toLowerCase();
                const awayName = match.awayTeam.name.toLowerCase();
                if (!homeName.includes(query) && !awayName.includes(query)) {
                    return false;
                }
            }

            return true;
        });
    }

    return { init, applyFilters };
})();
