use protobuf::Message;
use std::collections::HashMap;
use tree_sitter_highlight::Error;
use tree_sitter_highlight::{Highlight, HighlightEvent};

use rocket_contrib::json::JsonValue;
use tree_sitter_highlight::{HighlightConfiguration, Highlighter as TSHighlighter};

use crate::lsif::{Document, Occurrence, SyntaxKind};
use crate::{determine_language, SourcegraphQuery, SYNTAX_SET};

extern crate lazy_static;

#[rustfmt::skip]
// Table of (@CaptureGroup, SyntaxKind) mapping.
//
// Any capture defined in a query will be mapped to the following SyntaxKind via the highlighter.
//
// To extend what types of captures are included, simply add a line below that takes a particular
// match group that you're interested in and map it to a new SyntaxKind.
//
// We can also define our own new capture types that we want to use and add to queries to provide
// particular highlights if necessary.
//
// (I can also add per-language mappings for these if we want, but you could also just do that with
//  unique match groups. For example `@rust-bracket`, or similar. That doesn't need any
//  particularly new rust code to be written. You can just modify queries for that)
const MATCHES_TO_SYNTAX_KINDS: &[(&str, SyntaxKind)] = &[
    ("attribute",               SyntaxKind::UnspecifiedSyntaxKind),
    ("constant",                SyntaxKind::Identifier),
    ("constant.builtin",        SyntaxKind::BuiltinIdentifier),
    ("comment",                 SyntaxKind::Comment),
    ("function.builtin",        SyntaxKind::FunctionDefinition),
    ("function",                SyntaxKind::FunctionDefinition),
    ("method",                  SyntaxKind::Identifier),
    ("include",                 SyntaxKind::Keyword),
    ("keyword",                 SyntaxKind::Keyword),
    ("keyword.function",        SyntaxKind::Keyword),
    ("keyword.return",          SyntaxKind::Keyword),
    ("operator",                SyntaxKind::Operator),
    ("property",                SyntaxKind::UnspecifiedSyntaxKind),
    ("punctuation",             SyntaxKind::UnspecifiedSyntaxKind),
    ("punctuation.bracket",     SyntaxKind::UnspecifiedSyntaxKind),
    ("punctuation.delimiter",   SyntaxKind::UnspecifiedSyntaxKind),
    ("string",                  SyntaxKind::StringLiteral),
    ("string.special",          SyntaxKind::StringLiteral),
    ("tag",                     SyntaxKind::UnspecifiedSyntaxKind),
    ("type",                    SyntaxKind::TypeIdentifier),
    ("type.builtin",            SyntaxKind::TypeIdentifier),
    ("variable",                SyntaxKind::Identifier),
    ("variable.builtin",        SyntaxKind::UnspecifiedSyntaxKind),
    ("variable.parameter",      SyntaxKind::UnspecifiedSyntaxKind),
    ("conditional",             SyntaxKind::Keyword),
    ("boolean",                 SyntaxKind::BuiltinIdentifier),
];

/// Maps a highlight to a syntax kind.
/// This only works if you've correctly used the highlight_names from MATCHES_TO_SYNTAX_KINDS
fn get_syntax_kind_for_hl(hl: Highlight) -> SyntaxKind {
    MATCHES_TO_SYNTAX_KINDS[hl.0].1
}

lazy_static! {
    static ref CONFIGURATIONS: HashMap<&'static str, HighlightConfiguration> = {
        let mut m = HashMap::new();
        let higlight_names = MATCHES_TO_SYNTAX_KINDS.iter().map(|hl| hl.0).collect::<Vec<&str>>();

        {
            let mut lang = HighlightConfiguration::new(
                tree_sitter_go::language(),
                include_str!("../queries/go/highlights.scm").as_ref(),
                "",
                "",
            )
            .unwrap();
            lang.configure(&higlight_names);
            m.insert("go", lang);
        }

        // TODO(tjdevries): Would be fun to add SQL parser here and then embed it and be able to do
        // the const injection that I use for my own personal config to surprise some people with a
        // really neat feature.

        // Other languages can be added here.

        m
    };
}

pub fn lsif_highlight(q: SourcegraphQuery) -> Result<JsonValue, Error> {
    Ok(SYNTAX_SET.with(|syntax_set| {
        // Determine syntax definition by extension.
        let syntax_def = match determine_language(&q, syntax_set) {
            Ok(v) => v,
            Err(e) => return e,
        };

        match syntax_def.name.to_lowercase().as_str() {
            filetype @ "go" => {
                // TODO: Can encode this with json if we use protobuf 3.0.0-alpha,
                // but then we need to generate the bindings that way too.
                //
                // For now just send the bytes as an array of bytes (can be deserialized in backend
                // I guess and then sent to typescript land via JSON).
                let data = index_language(filetype, &q.code).unwrap();
                let encoded = data.write_to_bytes().unwrap();
                json!({"data": encoded, "plaintext": false})
            }
            _ => {
                unreachable!();
            }
        }
    }))
}

pub fn index_language(filetype: &str, code: &str) -> Result<Document, Error> {
    let mut highlighter = TSHighlighter::new();
    let lang_config = &CONFIGURATIONS[filetype];
    let highlights = highlighter
        .highlight(&lang_config, code.as_bytes(), None, |l| {
            Some(&CONFIGURATIONS[l])
        })
        .unwrap();

    let mut emitter = LsifEmitter::new();
    emitter.render(highlights, code, &get_syntax_kind_for_hl)
}

struct LineManager {
    offsets: Vec<usize>,
}

impl LineManager {
    fn new(s: &str) -> Self {
        let mut offsets = Vec::new();
        let mut pos = 0;
        for line in s.lines() {
            offsets.push(pos);
            pos += line.len() + 1;
        }

        Self { offsets }
    }

    fn line_and_col(&self, offset: usize) -> (usize, usize) {
        let mut line = 0;
        for window in self.offsets.windows(2) {
            let curr = window[0];
            let next = window[1];
            if next > offset {
                return (line, offset - curr);
            }

            line += 1;
        }

        (line, offset - self.offsets.last().unwrap())
    }

    fn range(&self, start: usize, end: usize) -> Vec<i32> {
        // TODO: Do the optimization

        let start_line = self.line_and_col(start);
        let end_line = self.line_and_col(end);

        if start_line.0 == end_line.0 {
            vec![start_line.0 as i32, start_line.1 as i32, end_line.1 as i32]
        } else {
            vec![
                start_line.0 as i32,
                start_line.1 as i32,
                end_line.0 as i32,
                end_line.1 as i32,
            ]
        }
    }
}

#[derive(Debug, PartialEq, Eq, Ord)]
pub struct PackedRange {
    pub start_line: i32,
    pub start_col: i32,
    pub end_line: i32,
    pub end_col: i32,
}

impl PackedRange {
    pub fn from_vec(v: &Vec<i32>) -> Self {
        match v.len() {
            3 => Self {
                start_line: v[0],
                start_col: v[1],
                end_line: v[0],
                end_col: v[2],
            },
            4 => Self {
                start_line: v[0],
                start_col: v[1],
                end_line: v[2],
                end_col: v[3],
            },
            _ => {
                panic!("Unexpected vector length: {:?}", v);
            }
        }
    }
}

impl PartialOrd for PackedRange {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        (self.start_line, self.end_line, self.start_col).partial_cmp(&(
            other.start_line,
            other.end_line,
            other.start_col,
        ))
    }
}

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
        source: &str,
        _attribute_callback: &F,
    ) -> Result<Document, Error>
    where
        F: Fn(Highlight) -> SyntaxKind,
    {
        // let mut highlights = Vec::new();
        let mut doc = Document::new();

        let line_manager = LineManager::new(source);

        let mut highlights = vec![];
        for event in highlighter {
            match event {
                Ok(HighlightEvent::HighlightStart(s)) => {
                    highlights.push(s);
                }
                Ok(HighlightEvent::HighlightEnd) => {
                    highlights.pop();
                }
                Ok(HighlightEvent::Source { start, end }) => match highlights.len() {
                    // No highlights matched for this range
                    0 => {}

                    // When a `start`->`end` has some highlights
                    _ => {
                        if highlights.len() > 1 {
                            println!("Highlights: {:?}", highlights);
                        }

                        let mut occurence = Occurrence::new();
                        occurence.range = line_manager.range(start, end);
                        occurence.syntax_kind = get_syntax_kind_for_hl(*highlights.last().unwrap());

                        doc.occurrences.push(occurence);
                    }
                },
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
        let document = index_language("go", "// Hello World")?;
        assert_eq!(document.relative_path, Document::default().relative_path);

        Ok(())
    }
}
