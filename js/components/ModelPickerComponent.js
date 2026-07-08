/**
 * Model Picker Component
 * A button in the chat box that opens a popup panel with:
 *   - collapsible provider groups, each listing its models
 *   - a "think effort" group (low / medium / high)
 */

import { SELECTION_STORAGE_KEY as STORAGE_KEY } from '../utils/constants.js';

class ModelPickerComponent {
    /**
     * @param {HTMLElement} button - The trigger button in the input area
     * @param {HTMLElement} panel - The (empty) popup panel container
     * @param {Object} config - The global CONFIG object
     */
    constructor(button, panel, config) {
        this.button = button;
        this.panel = panel;
        this.config = config;

        this.selection = this._loadSelection();
        this._buildPanel();
        this._updateButtonLabel();

        // Toggle panel on button click
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Close on outside click or Escape
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && e.target !== this.button) {
                this.close();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    /**
     * Returns the current selection
     * @returns {{providerId: string, model: string, effort: string}}
     */
    getSelection() {
        return { ...this.selection };
    }

    toggle() {
        this.panel.classList.toggle('open');
    }

    close() {
        this.panel.classList.remove('open');
    }

    isOpen() {
        return this.panel.classList.contains('open');
    }

    // --- internal ---------------------------------------------------------

    _loadSelection() {
        const fallback = {
            providerId: this.config.DEFAULT_PROVIDER,
            model: this.config.DEFAULT_MODEL,
            effort: this.config.DEFAULT_EFFORT || 'medium'
        };

        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (
                saved &&
                this.config.PROVIDERS[saved.providerId] &&
                this.config.PROVIDERS[saved.providerId].models.includes(saved.model)
            ) {
                return { ...fallback, ...saved };
            }
        } catch { /* corrupted storage — use fallback */ }

        return fallback;
    }

    _saveSelection() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.selection));
    }

    _updateButtonLabel() {
        // Show a short model name, e.g. "tencent/hy3:free" -> "hy3:free"
        const shortName = this.selection.model.split('/').pop();
        const label = shortName === 'default'
            ? this.config.PROVIDERS[this.selection.providerId].label
            : shortName;

        this.button.textContent = '';
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        const chevron = document.createElement('span');
        chevron.className = 'mp-chevron';
        chevron.textContent = '⌄';
        this.button.appendChild(labelSpan);
        this.button.appendChild(chevron);
    }

    _buildPanel() {
        this.panel.innerHTML = '';

        // Section 1: providers and their models
        for (const [id, provider] of Object.entries(this.config.PROVIDERS)) {
            const group = this._createGroup(
                `# ${provider.label}`,
                provider.models,
                (model) => this.selection.providerId === id && this.selection.model === model,
                (model) => {
                    this.selection.providerId = id;
                    this.selection.model = model;
                    this._saveSelection();
                    this._refreshChecks();
                    this._updateButtonLabel();
                    this.close();
                },
                // Start expanded if this provider holds the current selection
                this.selection.providerId === id
            );
            this.panel.appendChild(group);
        }

        // Divider
        const divider = document.createElement('div');
        divider.className = 'mp-divider';
        this.panel.appendChild(divider);

        // Section 2: think effort
        const effortGroup = this._createGroup(
            '# think effort',
            ['low', 'medium', 'high'],
            (level) => this.selection.effort === level,
            (level) => {
                this.selection.effort = level;
                this._saveSelection();
                this._refreshChecks();
                this.close();
            },
            false
        );
        this.panel.appendChild(effortGroup);
    }

    _createGroup(title, items, isSelected, onSelect, startExpanded) {
        const group = document.createElement('div');
        group.className = 'mp-group';

        const header = document.createElement('button');
        header.className = 'mp-group-header';
        header.innerHTML = `<span>${title}</span><span class="mp-arrow">›</span>`;

        const list = document.createElement('div');
        list.className = 'mp-models';
        if (startExpanded) {
            list.classList.add('expanded');
            header.classList.add('expanded');
        }

        header.addEventListener('click', (e) => {
            e.stopPropagation();
            list.classList.toggle('expanded');
            header.classList.toggle('expanded');
        });

        for (const item of items) {
            const option = document.createElement('button');
            option.className = 'mp-model';
            option.dataset.value = item;
            option.innerHTML = `<span class="mp-check">✓</span><span>${item}</span>`;
            if (isSelected(item)) option.classList.add('selected');

            option.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelect(item);
            });

            list.appendChild(option);
        }

        // Used by _refreshChecks to re-evaluate selection marks
        group._isSelected = isSelected;

        group.appendChild(header);
        group.appendChild(list);
        return group;
    }

    _refreshChecks() {
        this.panel.querySelectorAll('.mp-group').forEach(group => {
            group.querySelectorAll('.mp-model').forEach(option => {
                option.classList.toggle('selected', group._isSelected(option.dataset.value));
            });
        });
    }
}

export default ModelPickerComponent;
