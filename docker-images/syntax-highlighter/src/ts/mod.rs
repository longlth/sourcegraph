use std::collections::HashMap;
use tree_sitter_highlight::Error;
use tree_sitter_highlight::{Highlight, HighlightEvent};

use rocket_contrib::json::JsonValue;
use tree_sitter_highlight::{HighlightConfiguration, Highlighter as TSHighlighter};

use crate::lsif::{Document, Occurrence, SyntaxKind};
use crate::{determine_language, SourcegraphQuery, SYNTAX_SET};

extern crate lazy_static;

const HIGHLIGHT_NAMES: &[&str; 20] = &[
    "attribute",
    "constant",
    "comment",
    "function.builtin",
    "function",
    "include",
    "keyword",
    "operator",
    "property",
    "punctuation",
    "punctuation.bracket",
    "punctuation.delimiter",
    "string",
    "string.special",
    "tag",
    "type",
    "type.builtin",
    "variable",
    "variable.builtin",
    "variable.parameter",
];

const CLASS_NAMES: &[SyntaxKind; 20] = &[
    // "class='hl-attribute'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-constant'",
    SyntaxKind::Identifier,
    // "class='hl-comment'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-function.builtin'",
    SyntaxKind::MethodIdentifier,
    // "class='hl-function'",
    SyntaxKind::MethodIdentifier,
    // "class='hl-include'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-keyword'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-operator'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-property'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-punctuation'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-punctuation.bracket'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-punctuation.delimiter'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-string'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-string.special'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-tag'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-type'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-type.builtin'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-variable'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-variable.builtin'",
    SyntaxKind::UnspecifiedSyntaxKind,
    // "class='hl-variable.parameter'",
    SyntaxKind::UnspecifiedSyntaxKind,
];

lazy_static! {
    static ref CONFIGURATIONS: HashMap<&'static str, HighlightConfiguration> = {
        let mut m = HashMap::new();

        {
            let mut lang = HighlightConfiguration::new(
                tree_sitter_go::language(),
                include_str!("../../queries/go/highlights.scm").as_ref(),
                "",
                "",
            )
            .unwrap();
            lang.configure(HIGHLIGHT_NAMES);
            m.insert("go", lang);
        }

        // Other languages can be added here.

        m
    };
}

pub fn lsif_highlight(q: SourcegraphQuery) -> JsonValue {
    SYNTAX_SET.with(|syntax_set| {
        // Determine syntax definition by extension.
        let syntax_def = match determine_language(&q, syntax_set) {
            Ok(v) => v,
            Err(e) => return e,
        };

        println!("RUNNING: {}", syntax_def.name.to_lowercase());
        match syntax_def.name.to_lowercase().as_str() {
            filetype @ "go" => {
                let mut highlighter = TSHighlighter::new();
                let lang_config = &CONFIGURATIONS[filetype];

                let highlights = highlighter
                    .highlight(&lang_config, q.code.as_bytes(), None, |l| {
                        println!("Some language: {}", l);
                        Some(&CONFIGURATIONS[l])
                    })
                    .unwrap();

                let mut emitter = LsifEmitter::new();
                let data = emitter
                    .render(highlights, q.code.as_bytes(), &|highlight| {
                        // println!("Highlight from render: {:?}", highlight);
                        CLASS_NAMES[highlight.0]
                    })
                    .unwrap();

                json!({"data": format!("{:?}", data), "plaintext": false})
            }
            _ => {
                unreachable!();
            }
        }
    })
}

/// Represents the reason why syntax highlighting failed.

/// Converts a general-purpose syntax highlighting iterator into a sequence of lines of HTML.
pub struct LsifEmitter {}

/// Our version of `tree_sitter_highlight::HtmlRenderer`, which emits stuff as a table.
///
/// You can see the original version in the tree_sitter_highlight crate.
impl LsifEmitter {
    pub fn new() -> Self {
        LsifEmitter {}
    }

    pub fn render<'a, F>(
        &mut self,
        highlighter: impl Iterator<Item = Result<HighlightEvent, Error>>,
        _source: &'a [u8],
        _attribute_callback: &F,
    ) -> Result<Document, Error>
    where
        F: Fn(Highlight) -> SyntaxKind,
    {
        // let mut highlights = Vec::new();
        let mut doc = Document::new();

        let mut highlight = None;
        for event in highlighter {
            match event {
                Ok(HighlightEvent::HighlightStart(s)) => {
                    if let Some(_) = highlight {
                        panic!("Oh no, double highlight");
                    }
                    highlight = Some(s);
                }
                Ok(HighlightEvent::HighlightEnd) => {
                    if let None = highlight {
                        panic!("Oh no, we made a mistake");
                    }

                    highlight = None;
                }
                Ok(HighlightEvent::Source { start, end }) => {
                    // self.add_text(&source[start..end], &highlights, attribute_callback);
                    println!("Source: {} -> {} :: {:?}", start, end, highlight);
                    match highlight {
                        Some(hl) => {
                            let mut occurence = Occurrence::new();
                            occurence.syntax_kind = CLASS_NAMES[hl.0];

                            doc.occurrences.push(occurence);
                        }
                        None => {
                            println!("Nothing");
                        }
                    }
                    // crate::lsif::Occurrence {
                    //     range: vec![start, end],
                    //     symbol: "",
                    //     symbol_roles: 0,
                    //     override_documentation: vec![],
                    //     syntax_kind: SyntaxKind::Identifier,
                    //     cached_size: (),
                    // }
                }
                Err(a) => return Err(a),
            }
        }

        // if self.highlighted.last() != Some(&b'\n') {
        //     self.highlighted.push(b'\n');
        // }

        // Just guess that we need something twice as long, so we don't have a lot of resizes
        // self.html = Vec::with_capacity(self.highlighted.len() * 2);

        // This is the same format as ClassedTableGenerator
        //
        // TODO: Could probably try and make these share some code :)
        //
        //     <tr>
        //       <td class="line" data-line="1">
        //       <td class="code">
        //         <span class="hl-source hl-go">
        //           <span class="hl-keyword hl-control hl-go">package</span>
        //           main
        //         </span>
        //       </td>
        //     </tr>
        // self.html.extend_from_slice("<table><tbody>".as_bytes());
        // for (idx, line) in self.highlighted.lines().enumerate() {
        //     let line = line.unwrap();
        //     self.html.extend_from_slice(
        //         format!(
        //             r#"<tr><td class="line" data-line="{}"><td class="code"><div>{}</div></td></tr>"#,
        //             idx + 1,
        //             line
        //         )
        //         .as_bytes(),
        //     );
        // }
        // self.html.extend_from_slice("</tbody></table>".as_bytes());

        Ok(doc)
    }

    // fn start_highlight<'a, F>(&mut self, h: Highlight, attribute_callback: &F)
    // where
    //     F: Fn(Highlight) -> &'a [u8],
    // {
    //     let attribute_string = (attribute_callback)(h);
    //     self.highlighted.extend(b"<span");
    //     if !attribute_string.is_empty() {
    //         self.highlighted.extend(b" ");
    //         self.highlighted.extend(attribute_string);
    //     }
    //     self.highlighted.extend(b">");
    // }
    //
    // fn end_highlight(&mut self) {
    //     self.highlighted.extend(b"</span>");
    // }
    //
    // fn add_text<'a, F>(&mut self, src: &[u8], highlights: &Vec<Highlight>, attribute_callback: &F)
    // where
    //     F: Fn(Highlight) -> &'a [u8],
    // {
    //     let mut last_char_was_cr = false;
    //     for c in LossyUtf8::new(src).flat_map(|p| p.bytes()) {
    //         // Don't render carriage return characters, but allow lone carriage returns (not
    //         // followed by line feeds) to be styled via the attribute callback.
    //         if c == b'\r' {
    //             last_char_was_cr = true;
    //             continue;
    //         }
    //         if last_char_was_cr {
    //             last_char_was_cr = false;
    //         }
    //
    //         // At line boundaries, close and re-open all of the open tags.
    //         if c == b'\n' {
    //             highlights.iter().for_each(|_| self.end_highlight());
    //             self.highlighted.push(c);
    //             highlights
    //                 .iter()
    //                 .for_each(|scope| self.start_highlight(*scope, attribute_callback));
    //         } else if let Some(escape) = html_escape(c) {
    //             self.highlighted.extend_from_slice(escape);
    //         } else {
    //             self.highlighted.push(c);
    //         }
    //     }
    // }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_highlights_one_comment() -> Result<(), Error> {
        Ok(())
    }
}
