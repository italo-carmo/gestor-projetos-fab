import { Extension } from '@tiptap/core';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const ParagraphLayout = Extension.create({
  name: 'paragraphLayout',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
          paragraphSpacingAfter: {
            default: null,
            parseHTML: (element) => element.style.marginBottom || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphSpacingAfter) return {};
              return {
                style: `margin-bottom: ${attributes.paragraphSpacingAfter}`,
              };
            },
          },
          paragraphMarginLeft: {
            default: null,
            parseHTML: (element) => element.style.marginLeft || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphMarginLeft) return {};
              return { style: `margin-left: ${attributes.paragraphMarginLeft}` };
            },
          },
          paragraphMarginRight: {
            default: null,
            parseHTML: (element) => element.style.marginRight || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphMarginRight) return {};
              return {
                style: `margin-right: ${attributes.paragraphMarginRight}`,
              };
            },
          },
          paragraphFirstLineIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphFirstLineIndent) return {};
              return {
                style: `text-indent: ${attributes.paragraphFirstLineIndent}`,
              };
            },
          },
        },
      },
    ];
  },
});

export const documentEditorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    undoRedo: false,
  }),
  TextStyle,
  FontSize,
  FontFamily,
  Color,
  Underline,
  ParagraphLayout,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Image.configure({ allowBase64: true }),
];
