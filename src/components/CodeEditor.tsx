import { useEffect, useRef } from "react";
import { useT } from "../i18n/useT";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightSpecialChars,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { python } from "@codemirror/lang-python";

// Custom dark theme replacing @codemirror/theme-one-dark to avoid
// Bun bundler initialization issues with that package.
const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#1a1b26",
      color: "#e2e8f0",
      height: "100%",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    ".cm-content": {
      caretColor: "#7c5cfc",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#7c5cfc",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(124, 92, 252, 0.2)",
    },
    ".cm-panels": {
      backgroundColor: "#1a1b26",
      color: "#e2e8f0",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(255, 153, 0, 0.3)",
      outline: "1px solid rgba(255, 153, 0, 0.5)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(124, 92, 252, 0.4)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(124, 92, 252, 0.15)",
    },
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "rgba(124, 92, 252, 0.3)",
    },
    ".cm-gutters": {
      backgroundColor: "#1a1b26",
      color: "#4a5568",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "#7c5cfc",
    },
    ".cm-tooltip": {
      border: "1px solid rgba(255, 255, 255, 0.1)",
      backgroundColor: "#252f3e",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: "#252f3e",
      borderBottomColor: "#252f3e",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(124, 92, 252, 0.2)",
        color: "#e2e8f0",
      },
    },
  },
  { dark: true },
);

interface CodeEditorProps {
  content: string;
  language: string;
  onChange: (content: string) => void;
  onSave: (content: string) => void;
  readOnly?: boolean;
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "typescript":
    case "javascript":
    case "tsx":
    case "jsx":
      return javascript({ typescript: lang.startsWith("t"), jsx: lang.endsWith("x") });
    case "css":
      return css();
    case "json":
      return json();
    case "markdown":
    case "md":
      return markdown();
    case "html":
      return html();
    case "python":
      return python();
    default:
      return [];
  }
}

export function CodeEditor({
  content,
  language,
  onChange,
  onSave,
  readOnly = false,
}: CodeEditorProps): JSX.Element {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: (view) => {
          onSave(view.state.doc.toString());
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightSpecialChars(),
        history(),
        bracketMatching(),
        indentOnInput(),
        highlightSelectionMatches(),
        ...(defaultHighlightStyle
          ? [syntaxHighlighting(defaultHighlightStyle, { fallback: true })]
          : []),
        darkTheme,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        saveKeymap,
        updateListener,
        languageCompartment.current.of(getLanguageExtension(language)),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []); // Only init once

  // Update content when prop changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: content },
      });
    }
  }, [content]);

  // Update language when it changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.current.reconfigure(getLanguageExtension(language)),
    });
  }, [language]);

  // Update readOnly
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-hidden rounded-xl border border-white/5 [&_.cm-editor]:outline-none"
      aria-label={t("editor.label")}
    />
  );
}
