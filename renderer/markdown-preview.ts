/// <reference path="./emoji.ts" />
/// <reference path="lib.d.ts" />

import * as path from 'path';
import {unescape} from 'querystring';
import {shell} from 'electron';
import * as marked from 'marked';
import * as katex from 'katex';
import {highlight} from 'highlight.js';
import * as he from 'he';

let element_env: MarkdownPreview = null; // XXX
const emoji_replacer = new Emoji.Replacer(path.dirname(__dirname) + '/images');

marked.setOptions({
    highlight: function(code: string, lang: string): string {
        if (lang === undefined) {
            return code;
        }

        if (lang === 'mermaid') {
            return '<div class="mermaid">' + code + '</div>';
        }

        if (lang === 'katex') {
            return '<div class="katex">' + katex.renderToString(code, {displayMode: true}) + '</div>';
        }

        try {
            return highlight(lang, code).value;
        } catch (e) {
            console.log('Error on highlight: ' + e.message);
            return code;
        }
    },
});

const REGEX_CHECKED_LISTITEM = /^\[x]\s+/;
const REGEX_UNCHECKED_LISTITEM = /^\[ ]\s+/;

class MarkdownRenderer {
    public outline: Heading[];
    private renderer: MarkedRenderer;
    private link_id: number;
    private tooltips: string;

    constructor(public markdown_exts: string[]) {
        this.renderer = new marked.Renderer();

        // TODO:
        // 'this' is set to renderer methods automatically so we need to preserve
        // this scope's 'this' as 'self'.
        const self = this;

        this.renderer.listitem = function(text: string) {
            let matched = text.match(REGEX_CHECKED_LISTITEM);
            if (matched && matched[0]) {
                return '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" checked="checked" disabled="disabled">'
                    + text.slice(matched[0].length) + '</li>\n';
            }

            matched = text.match(REGEX_UNCHECKED_LISTITEM);
            if (matched && matched[0]) {
                return '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled="disabled">'
                    + text.slice(matched[0].length) + '</li>\n';
            }

            return marked.Renderer.prototype.listitem.call(this, text);
        };

        this.renderer.text = function(text: string) {
            return emoji_replacer.replaceWithImages(text);
        };

        this.renderer.link = function(href: string, title: string, text: string) {
            if (!href) {
                return marked.Renderer.prototype.link.call(this, href, title, text);
            }

            if (this.options.sanitize) {
                try {
                    const prot = decodeURIComponent(unescape(href))
                        .replace(/[^\w:]/g, '')
                        .toLowerCase();
                    if (prot.startsWith('javascript:') || prot.startsWith('vbscript:')) {
                        return '';
                    }
                } catch (e) {
                    return '';
                }
            }

            let onclick = 'cancelClick(event)';
            const ext_idx = href.lastIndexOf('.');

            if (href.startsWith('http://') || href.startsWith('https://')) {
                onclick = 'openLinkWithExternalBrowser(event)';
            } else if (ext_idx !== -1) {
                const ext = href.slice(ext_idx + 1);
                if (self.markdown_exts.indexOf(ext) !== -1) {
                    onclick = 'openMarkdownLink(event)';
                }
            } else if (href.indexOf('#') !== -1) {
                onclick = 'openHashLink(event)';
            }

            self.link_id += 1;
            const id = `md-link-${self.link_id}`;
            self.tooltips += `<paper-tooltip for="${id}" offset="0">${he.encode(href)}</paper-tooltip>`;

            return title !== null ?
                `<a id="${id}" href="${href}" onclick="${onclick}" title=${title}>${text}</a>` :
                `<a id="${id}" href="${href}" onclick="${onclick}">${text}</a>`;
        };

        this.renderer.heading = function(text: string, level: number, raw: string) {
            const hash = this.options.headerPrefix + raw.toLowerCase().replace(/[^\w]+/g, '-');
            self.outline.push({
                title: raw,
                hash,
                level,
                html: text,
            });
            return marked.Renderer.prototype.heading.call(this, text, level, raw);
        };

        this.renderer.code = function(code: string, lang: string, escaped: boolean) {
            if (!lang || lang === 'mermaid' || lang === 'katex') {
                return marked.Renderer.prototype.code.call(this, code, lang, escaped);
            }

            if (this.options.highlight) {
                const out = this.options.highlight(code, lang);
                if (out != null && out !== code) {
                    escaped = true;
                    code = out;
                }
            }

            if (!escaped) {
                code = he.encode(code);
            }

            return `<code-block lang="${he.encode(lang)}">${code}\n</code-block>\n`;
        };
    }

    render(markdown: string): string {
        this.link_id = 0;
        this.tooltips = '';
        this.outline = [];
        return marked(markdown, {renderer: this.renderer}) + this.tooltips;
    }
}

/* tslint:disable:no-unused-variable */
function openMarkdownLink(event: MouseEvent) {
/* tslint:enable:no-unused-variable */
    event.preventDefault();

    let target = event.target as HTMLAnchorElement;
    while (target !== null) {
        if (target.href) {
            break;
        }
        target = target.parentElement as HTMLAnchorElement;
    }
    if (target === null) {
        console.log('openMarkdownLink(): No target <a> was found', event);
        return;
    }

    let path = unescape(target.href);
    if (path.startsWith('file://')) {
        path = path.slice(7); // Omit 'file://'
    }

    if (element_env.openMarkdownDoc) {
        element_env.openMarkdownDoc(path, event.ctrlKey || event.metaKey);
    } else {
        console.log('openMarkdownDoc() is not defined!! Link ignored: ' + path);
    }
}

/* tslint:disable:no-unused-variable */
function openHashLink(event: MouseEvent) {
/* tslint:enable:no-unused-variable */
    event.preventDefault();
    const target = event.target as HTMLAnchorElement;
    const hash_name: string = target.href.split('#')[1];
    location.hash = hash_name;
}

/* tslint:disable:no-unused-variable */
function openLinkWithExternalBrowser(event: MouseEvent) {
/* tslint:enable:no-unused-variable */
    event.preventDefault();
    const e = event.target as HTMLElement & {src?: string; href?: string};
    shell.openExternal(e.href ? e.href : e.src);
}

/* tslint:disable:no-unused-variable */
function cancelClick(event: MouseEvent) {
/* tslint:enable:no-unused-variable */
    event.preventDefault();
}

Polymer({
    is: 'markdown-preview',

    properties: {
        document: {
            type: String,
            observer: '_documentUpdated',
        },

        exts: {
            type: Array,
            value: function(){ return [] as string[]; },
        },

        currentOutline: {
            type: Array,
            value: function(){ return [] as Heading[]; },
        },

        openMarkdownDoc: Object,

        fontSize: String,
    },

    ready: function() {
        element_env = this; // XXX
    },

    attached: function() {
        this.renderer = new MarkdownRenderer(this.exts);
        const body = document.querySelector('.markdown-body') as HTMLDivElement;
        body.style.fontSize = this.fontSize;
    },

    _documentUpdated: function(updated_doc) {
        const body = document.querySelector('.markdown-body') as HTMLDivElement;
        body.innerHTML = this.renderer.render(updated_doc);
        this.currentOutline = this.renderer.outline;
        if (document.querySelector('.lang-mermaid') !== null) {
            mermaid.init();
        }
    },

    scrollToHeading: function(scroller: Scroller, h: Heading) {
        const elem = document.getElementById(h.hash);
        if (elem) {
            scroller.scrollTop = elem.offsetTop;
        }
    },
} as MarkdownPreviewComponent);
