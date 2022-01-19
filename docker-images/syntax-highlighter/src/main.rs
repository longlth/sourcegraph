#![allow(macro_expanded_macro_exports_accessed_by_absolute_paths)]

extern crate rayon;
#[macro_use]
extern crate rocket;
#[macro_use]
extern crate rocket_contrib;
extern crate serde_json;
extern crate syntect;

use rocket_contrib::json::{Json, JsonValue};
use sg_syntax::SourcegraphQuery;
use std::env;
use std::panic;

#[post("/", format = "application/json", data = "<q>")]
fn index(q: Json<SourcegraphQuery>) -> JsonValue {
    // TODO(slimsag): In an ideal world we wouldn't be relying on catch_unwind
    // and instead Syntect would return Result types when failures occur. This
    // will require some non-trivial work upstream:
    // https://github.com/trishume/syntect/issues/98
    let result = panic::catch_unwind(|| sg_syntax::syntect_highlight(q.into_inner()));
    match result {
        Ok(v) => v,
        Err(_) => json!({"error": "panic while highlighting code", "code": "panic"}),
    }
}

#[post("/lsif", format = "application/json", data = "<q>")]
fn lsif(q: Json<SourcegraphQuery>) -> JsonValue {
    sg_syntax::lsif_highlight(q.into_inner())
}

#[get("/health")]
fn health() -> &'static str {
    "OK"
}

#[catch(404)]
fn not_found() -> JsonValue {
    json!({"error": "resource not found", "code": "resource_not_found"})
}

#[launch]
fn rocket() -> rocket::Rocket {
    // Only list features if QUIET != "true"
    match env::var("QUIET") {
        Ok(v) => {
            if v != "true" {
                sg_syntax::list_features()
            }
        }
        Err(_) => sg_syntax::list_features(),
    };

    rocket::ignite()
        .mount("/", routes![index, lsif, health])
        .register(catchers![not_found])
}
