use std::collections::VecDeque;
use std::fs;

use sg_syntax::lsif::{Document, SyntaxKind};
use sg_syntax::{lsif_index, LsifPackedRange};

fn dump_document(doc: Document, source: &str) -> String {
    let mut occurences = doc.get_occurrences().to_owned().clone();
    occurences.sort_by_key(|o| {
        let range = LsifPackedRange::from_vec(&o.range);
        range
    });
    let mut occurences = VecDeque::from(occurences);

    // dbg!(&occurences);

    let mut result = String::new();

    for (idx, line) in source.lines().enumerate() {
        result += "  ";
        result += &line.replace("\t", " ");
        result += "\n";

        while let Some(occ) = occurences.pop_front() {
            if occ.syntax_kind == SyntaxKind::UnspecifiedSyntaxKind {
                continue;
            }

            let range = LsifPackedRange::from_vec(&occ.range);
            if range.start_line != range.end_line {
                continue;
            }

            if range.start_line != idx as i32 {
                occurences.push_front(occ);
                break;
            }

            let length = (range.end_col - range.start_col) as usize;

            result.push_str(&format!(
                "//{}{} {:?}\n",
                " ".repeat(range.start_col as usize),
                "^".repeat(length),
                occ.syntax_kind
            ));
        }
    }

    result
}

fn main() {
    if let Some(path) = std::env::args().nth(1) {
        let contents = fs::read_to_string(path).unwrap();
        let document = lsif_index("go", &contents).unwrap();

        println!("\n\n{}", dump_document(document, &contents));
        // println!("{}", dump_document())
    } else {
        panic!("Must pass a filepath");
    }
}
