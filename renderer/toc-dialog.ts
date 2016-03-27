/// <reference path="lib.d.ts" />

Polymer({
    is: 'toc-dialog',

    properties: {
        opened: {
            type: Boolean,
            value: false,
        },
        currentItems: {
            type: Array,
            value: [],
        },
        currentOutline: {
            type: Array,
            value: [],
        },
        selectedIdx: Number,
        innerDialog: Object,
        scrollCallback: Object,
        onMount: Object,
        onUnmount: Object,
    },

    open: function(outline: Heading[]) {
        if (!this.innerDialog) {
            return;
        }

        if (outline.length > 0) {
            const elems = outline.map((h, i) => {
                const outer = document.createElement('paper-item');
                const inner = document.createElement('paper-item-body');
                const header = document.createElement('h' + h.level);
                header.innerHTML = '#'.repeat(h.level) + h.html;
                outer.addEventListener('click', () => this.selectItem(i));
                inner.appendChild(header);
                outer.appendChild(inner);
                return outer;
            });
            const listbox = document.getElementById('toc-listbox');
            while (listbox.firstChild) {
                listbox.removeChild(listbox.firstChild);
            }
            for (const e of elems) {
                listbox.appendChild(e);
            }
            this.currentItems = elems;
            this.currentOutline = outline;
            this.selectedIdx = -1;
        }
        this.innerDialog.open();
        this.opened = true;
        if (this.onMount) {
            this.onMount();
        }
    },

    selectItem: function(idx: number) {
        if (idx !== undefined && 0 <= idx && idx < this.currentItems.length) {
            if (this.scrollCallback) {
                this.scrollCallback(this.currentOutline[idx]);
            }
        }
        this.close();
    },

    close: function() {
        if (!this.innerDialog) {
            return;
        }

        this.innerDialog.close();
        this.opened = false;
        this.selectedIdx = undefined;
        this.currentItems = [];
        this.currentOutline = [];
        if (this.onUnmount) {
            this.onUnmount();
        }
    },

    toggle: function(outline: Heading[] = []) {
        if (this.opened) {
            this.close();
        } else {
            this.open(outline);
        }
    },

    focusNext: function() {
        if (this.selectedIdx === undefined || this.currentItems.length === 0) {
            return;
        }
        ++this.selectedIdx;
        if (this.selectedIdx >= this.currentItems.length) {
            this.selectedIdx = 0;
        }
        this.currentItems[this.selectedIdx].focus();
    },

    focusPrevious: function() {
        if (this.selectedIdx === undefined || this.currentItems.length === 0) {
            return;
        }
        --this.selectedIdx;
        if (this.selectedIdx < 0) {
            this.selectedIdx = this.currentItems.length - 1;
        }
        this.currentItems[this.selectedIdx].focus();
    },

    ready: function() {
        this.innerDialog = (document.getElementById('toc-body') as any) as PaperDialogElement;
        document.getElementById('toc-body').addEventListener('keydown', (event: KeyboardEvent & {code: string}) => {
            switch (event.code) {
            case 'Enter':
                this.selectItem(this.selectedIdx);
                break;
            case 'KeyJ':
                this.focusNext();
                break;
            case 'KeyK':
                this.focusPrevious();
                break;
            case 'Escape':
                this.close();
                break;
            case 'KeyG':
                if (event.ctrlKey) {
                    this.close();
                }
                break;
            default:
                break;
            }
        });
    },
});
