import { mjmlConvert, debounce } from './utils';
import loadMjml from './mjml';
import loadHead from './Head';
import loadStyle from './Style';
import loadFont from './Font';
import loadBody from './Body';
import loadWrapper from './Wrapper';
import loadSection from './Section';
import loadGroup from './Group';
import loadColumn from './Column';
import loadText from './Text';
import loadButton from './Button';
import loadImage from './Image';
import loadSocial from './Social';
import loadSocialElement from './SocialElement';
import loadDivider from './Divider';
import loadSpacer from './Spacer';
import loadNavBar from './NavBar';
import loadNavBarLink from './NavBarLink';
import loadHero from './Hero';
import loadRaw from './Raw';

export default (editor, opt = {}) => {
  const { Components  } = editor;
  const ComponentsView = Components.ComponentsView;
  const sandboxEl = document.createElement('div');


  // MJML Core model
  let coreMjmlModel = {
    init() {
      const attrs = { ...this.get('attributes') };
      const style = { ...this.get('style-default'), ...this.get('style') };

      for (let prop in style) {
        if (!(prop in attrs)) {
          attrs[prop] = style[prop];
        }
      }

      this.set('attributes', attrs);
      this.set('style', attrs);
      this.listenTo(this, 'change:style', this.handleStyleChange);
      this.listenTo(this, 'change:attributes', this.handleAttributeChange);
    },

    handleAttributeChange() {
      this.set('style', this.get('attributes'));
    },

    handleStyleChange() {
      this.set('attributes', this.get('style'));
    },


    getMjmlAttributes() {
      let attr = this.get('attributes') || {};
      delete attr.style;
      let src = this.get('src');
      if (src)
        attr.src = src;
      return attr;
    },


    /**
     * This will avoid rendering default attributes
     * @return {Object}
     */
    getAttrToHTML() {
      const attr = { ...this.get('attributes') };
      const style = { ...this.get('style-default') };
      delete attr.style;

      for (let prop in attr) {
        const value = attr[prop];

        if (value && value === style[prop]) {
          delete attr[prop];
        }
      }

      return attr;
    },


    /**
     * Rhave to change few things for hte MJML's xml (no id, style, class)
     */
    toHTML() {
      let code = '';
      let model = this;
      let tag = model.get('tagName'),
        sTag = model.get('void');

      // Build the string of attributes
      let strAttr = '';
      let attr = this.getAttrToHTML();
      for (let prop in attr) {
        let val = attr[prop];
        strAttr += typeof val !== 'undefined' && val !== '' ?
          ' ' + prop + '="' + val + '"' : '';
      }

      code += `<${tag}${strAttr}${sTag ? '/' : ''}>` + model.get('content');

      model.get('components').each((model) => {
        code += model.toHTML();
      });

      if (!sTag)
        code += `</${tag}>`;

      return code;
    },

  };


  /**
   * MJML Core View.
   * MJML is designed to compile from a valid MJML document therefore any time we update some component
   * we have to recompile its MJML to HTML.
   *
   * To get the proper HTML of our updated component we have to build a new MJML document and here we can
   * find different helpers to accomplish that (eg. `getMjmlTemplate`, `getInnerMjmlTemplate`).
   *
   * Once the MJML is compiled (in `getTemplateFromMjml`) we have to extract its HTML from the
   * element (`getTemplateFromEl`).
   *
   * We should also instruct the editor to understand where new inner components are placed in our compiled
   * HTML once they are dropped inside, for that case you can rely on `getChildrenSelector` in your
   * component definition.
   *
   * Each MJML element differs in its output HTML structure and might also change based on inner components
   * (you might need to change `getMjmlTemplate` based on current inner Components).
   *
   * One easy way to test the HTML output is to use MJML live editor (https://mjml.io/try-it-live) with the
   * "View HTML" enabled and check there how it changes in order to override properly provided helpers.
   *
   */
  let coreMjmlView = {
    init() {
      this.stopListening(this.model, 'change:style');
      this.listenTo(this.model, 'change:attributes change:src', this.rerender);
      this.debouncedRender = debounce(this.render.bind(this), 0);
    },


    rerender() {
      this.render(null, null, {}, 1);
    },

    /**
     * Get the base MJML template wrapper tags
     */
    getMjmlTemplate() {
      return {
        start: `<mjml>`,
        end: `</mjml>`,
      };
    },

    /**
     * Build the MJML of the current component
     */
    getInnerMjmlTemplate() {
      const { model } = this;
      const tagName = model.get('tagName');
      const attr = model.getMjmlAttributes();
      let strAttr = '';

      for (let prop in attr) {
        const val = attr[prop];
        strAttr += typeof val !== 'undefined' && val !== '' ?
          ' ' + prop + '="' + val + '"' : '';
      }

      return {
        start: `<${tagName}${strAttr}>`,
        end: `</${tagName}>`,
      };
    },

    /**
     * Get the proper HTML string from the element containing compiled MJML template.
     */
    getTemplateFromEl(sandboxEl) {
      return sandboxEl.firstChild.innerHTML;
    },

    /**
     * Get HTML from MJML template.
     */
    getTemplateFromMjml() {
      const mjmlTmpl = this.getMjmlTemplate();
      const innerMjml = this.getInnerMjmlTemplate();
      const mjml = `${mjmlTmpl.start}${innerMjml.start}${innerMjml.end}${mjmlTmpl.end}`;
      const htmlOutput = mjmlConvert(mjml, opt.fonts);
      let html = htmlOutput.html;
      html = html.replace(/<body(.*)>/, '<body>');
      let start = html.indexOf('<body>') + 6;
      let end = html.indexOf('</body>');
      html = html.substring(start, end).trim();
      sandboxEl.innerHTML = html;
      return this.getTemplateFromEl(sandboxEl);
    },


    /**
     * Render children components
     * @private
     */
    renderChildren(appendChildren) {
      this.updateContent();
      const container = this.getChildrenContainer();

      // This trick will help perfs by caching children
      if (!appendChildren) {
        this.childrenView = this.childrenView || new ComponentsView({
          collection: this.model.get('components'),
          config: this.config,
          componentTypes: this.opts.componentTypes,
        });
        this.childNodes = this.childrenView.render(container).el.childNodes;
      } else {
        this.childrenView.parentEl = container;
      }

      const childNodes = Array.prototype.slice.call(this.childNodes);

      for (let i = 0, len = childNodes.length; i < len; i++) {
        container.appendChild(childNodes.shift());
      }
    },


    renderStyle() {
      this.el.style.cssText = this.attributes.style;
    },


    render(p, c, opts, appendChildren) {
      this.renderAttributes();
      this.el.innerHTML = this.getTemplateFromMjml();
      this.renderChildren(appendChildren);
      this.childNodes = this.getChildrenContainer().childNodes;
      this.renderStyle();

      return this;
    }
  };


  // MJML Internal view (for elements inside mj-columns)
  const compOpts = { coreMjmlModel, coreMjmlView, opt, sandboxEl };

  // Avoid the <body> tag from the default wrapper
  editor.Components.addType('wrapper', {
    model: {
      defaults: {
        highlightable: false,
      },
      toHTML(opts) {
        return this.getInnerHTML(opts);
      }
    }
  });

  loadMjml(editor, compOpts);
  loadHead(editor, compOpts);
  loadStyle(editor, compOpts);
  loadFont(editor, compOpts);
  loadBody(editor, compOpts);
  loadWrapper(editor, compOpts);
  loadSection(editor, compOpts);
  loadGroup(editor, compOpts);
  loadColumn(editor, compOpts);
  loadButton(editor, compOpts);
  loadText(editor, compOpts);
  loadImage(editor, compOpts);
  loadSocial(editor, compOpts);
  loadSocialElement(editor, compOpts);
  loadDivider(editor, compOpts);
  loadSpacer(editor, compOpts);
  loadNavBar(editor, compOpts);
  loadNavBarLink(editor, compOpts);
  loadHero(editor, compOpts);
  loadRaw(editor, compOpts);
};
