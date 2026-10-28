use std::collections::HashMap;

use affine_common::napi_utils::map_napi_err;
use affine_doc_loader::{
  self as doc_loader, Bounds, CanvasBlock, CanvasElement, CanvasProjectionV1, DocumentSearchProjectionV1,
  DocumentSearchUnit, MarkdownResult, PageDocContent, ProjectionWarning, SearchUnitSource, Visibility,
  WorkspaceDocContent,
};
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi(object)]
pub struct NativeMarkdownResult {
  pub title: String,
  pub markdown: String,
  pub known_unsupported_blocks: Vec<String>,
  pub unknown_blocks: Vec<String>,
}

impl From<MarkdownResult> for NativeMarkdownResult {
  fn from(result: MarkdownResult) -> Self {
    Self {
      title: result.title,
      markdown: result.markdown,
      known_unsupported_blocks: result.known_unsupported_blocks,
      unknown_blocks: result.unknown_blocks,
    }
  }
}

#[napi(object)]
pub struct NativePageDocContent {
  pub title: String,
  pub summary: String,
}

impl From<PageDocContent> for NativePageDocContent {
  fn from(result: PageDocContent) -> Self {
    Self {
      title: result.title,
      summary: result.summary,
    }
  }
}

#[napi(object)]
pub struct NativeWorkspaceDocContent {
  pub name: String,
  pub avatar_key: String,
}

impl From<WorkspaceDocContent> for NativeWorkspaceDocContent {
  fn from(result: WorkspaceDocContent) -> Self {
    Self {
      name: result.name,
      avatar_key: result.avatar_key,
    }
  }
}

#[napi(object)]
pub struct PublicDocMetaInput {
  pub id: String,
  pub title: Option<String>,
}

#[napi(object)]
pub struct NativeDocBounds {
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
}

impl From<Bounds> for NativeDocBounds {
  fn from(value: Bounds) -> Self {
    Self {
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
    }
  }
}

#[napi(object)]
pub struct NativeProjectionWarning {
  pub code: String,
  pub locator: String,
}

impl From<ProjectionWarning> for NativeProjectionWarning {
  fn from(value: ProjectionWarning) -> Self {
    Self {
      code: value.code,
      locator: value.locator,
    }
  }
}

fn visibility(value: Visibility) -> String {
  match value {
    Visibility::Page => "page",
    Visibility::Edgeless => "edgeless",
    Visibility::Both => "both",
  }
  .into()
}

#[napi(object)]
pub struct NativeCanvasProjectionBlock {
  pub id: String,
  #[napi(js_name = "type")]
  pub block_type: String,
  pub visibility: String,
  pub bounds: Option<NativeDocBounds>,
  pub text: Option<String>,
  pub title: Option<String>,
  pub child_ids: Vec<String>,
}

impl From<CanvasBlock> for NativeCanvasProjectionBlock {
  fn from(value: CanvasBlock) -> Self {
    Self {
      id: value.id,
      block_type: value.block_type,
      visibility: visibility(value.visibility),
      bounds: value.bounds.map(Into::into),
      text: value.text,
      title: value.title,
      child_ids: value.child_ids,
    }
  }
}

#[napi(object)]
pub struct NativeCanvasProjectionElement {
  pub id: String,
  #[napi(js_name = "type")]
  pub element_type: String,
  pub bounds: Option<NativeDocBounds>,
  pub text: Option<String>,
  pub title: Option<String>,
  pub frame_id: Option<String>,
  pub child_ids: Vec<String>,
  pub source_id: Option<String>,
  pub target_id: Option<String>,
  pub parent_id: Option<String>,
  pub index: Option<String>,
  pub point_count: Option<u32>,
  pub color: Option<String>,
  pub line_width: Option<f64>,
}

impl From<CanvasElement> for NativeCanvasProjectionElement {
  fn from(value: CanvasElement) -> Self {
    Self {
      id: value.id,
      element_type: value.element_type,
      bounds: value.bounds.map(Into::into),
      text: value.text,
      title: value.title,
      frame_id: value.frame_id,
      child_ids: value.child_ids,
      source_id: value.source_id,
      target_id: value.target_id,
      parent_id: value.parent_id,
      index: value.index,
      point_count: value.point_count,
      color: value.color,
      line_width: value.line_width,
    }
  }
}

#[napi(object)]
pub struct NativeCanvasProjection {
  pub version: u8,
  pub doc_id: String,
  pub revision: String,
  pub title: String,
  pub surface_block_id: Option<String>,
  pub bounds: Option<NativeDocBounds>,
  pub counts: HashMap<String, u32>,
  pub blocks: Vec<NativeCanvasProjectionBlock>,
  pub elements: Vec<NativeCanvasProjectionElement>,
  pub warnings: Vec<NativeProjectionWarning>,
}

impl From<CanvasProjectionV1> for NativeCanvasProjection {
  fn from(value: CanvasProjectionV1) -> Self {
    Self {
      version: value.version,
      doc_id: value.doc_id,
      revision: value.revision,
      title: value.title,
      surface_block_id: value.surface_block_id,
      bounds: value.bounds.map(Into::into),
      counts: value.counts.into_iter().collect(),
      blocks: value.blocks.into_iter().map(Into::into).collect(),
      elements: value.elements.into_iter().map(Into::into).collect(),
      warnings: value.warnings.into_iter().map(Into::into).collect(),
    }
  }
}

#[napi(object)]
pub struct NativeDocumentSearchUnit {
  pub unit_id: String,
  pub source: String,
  pub visibility: String,
  pub block_id: Option<String>,
  pub element_id: Option<String>,
  pub frame_id: Option<String>,
  pub blob_id: Option<String>,
  pub ref_doc_ids: Vec<String>,
  pub refs: Vec<String>,
  pub parent_flavour: Option<String>,
  pub parent_block_id: Option<String>,
  pub additional: Option<String>,
  #[napi(js_name = "type")]
  pub unit_type: String,
  pub text: String,
}

impl From<DocumentSearchUnit> for NativeDocumentSearchUnit {
  fn from(value: DocumentSearchUnit) -> Self {
    let source = match value.source {
      SearchUnitSource::PageBlock => "page-block",
      SearchUnitSource::CanvasBlock => "canvas-block",
      SearchUnitSource::SurfaceElement => "surface-element",
    };
    Self {
      unit_id: value.unit_id,
      source: source.into(),
      visibility: visibility(value.visibility),
      block_id: value.block_id,
      element_id: value.element_id,
      frame_id: value.frame_id,
      blob_id: value.blob_id,
      ref_doc_ids: value.ref_doc_ids,
      refs: value.refs,
      parent_flavour: value.parent_flavour,
      parent_block_id: value.parent_block_id,
      additional: value.additional,
      unit_type: value.unit_type,
      text: value.text,
    }
  }
}

#[napi(object)]
pub struct NativeDocumentSearchProjection {
  pub version: u8,
  pub doc_id: String,
  pub revision: String,
  pub source_hash: String,
  pub title: String,
  pub units: Vec<NativeDocumentSearchUnit>,
  pub warnings: Vec<NativeProjectionWarning>,
}

impl From<DocumentSearchProjectionV1> for NativeDocumentSearchProjection {
  fn from(value: DocumentSearchProjectionV1) -> Self {
    Self {
      version: value.version,
      doc_id: value.doc_id,
      revision: value.revision,
      source_hash: value.source_hash,
      title: value.title,
      units: value.units.into_iter().map(Into::into).collect(),
      warnings: value.warnings.into_iter().map(Into::into).collect(),
    }
  }
}

#[napi]
pub fn project_doc_canvas_from_binary(
  doc_bin: Buffer,
  doc_id: String,
  revision: String,
) -> Result<NativeCanvasProjection> {
  let projection = map_napi_err(
    doc_loader::project_canvas(doc_bin.into(), doc_id, revision),
    Status::GenericFailure,
  )?;
  Ok(projection.into())
}

#[napi(object)]
pub struct NativeWorkspaceRootProjection {
  pub complete: bool,
  pub doc_ids: Vec<String>,
}

#[napi]
pub fn project_workspace_root_from_binary(doc_bin: Buffer) -> Result<NativeWorkspaceRootProjection> {
  let projection = map_napi_err(
    doc_loader::project_workspace_root(doc_bin.into(), true),
    Status::GenericFailure,
  )?;
  Ok(NativeWorkspaceRootProjection {
    complete: projection.complete,
    doc_ids: projection.doc_ids,
  })
}

#[napi]
pub fn project_doc_search_from_binary(
  doc_bin: Buffer,
  doc_id: String,
  revision: String,
) -> Result<NativeDocumentSearchProjection> {
  let projection = map_napi_err(
    doc_loader::project_document_search(doc_bin.into(), doc_id, revision),
    Status::GenericFailure,
  )?;
  Ok(projection.into())
}

#[napi]
pub fn parse_page_doc(doc_bin: Buffer, max_summary_length: Option<i32>) -> Result<Option<NativePageDocContent>> {
  let result = map_napi_err(
    doc_loader::parse_page_doc(doc_bin.into(), max_summary_length.map(|v| v as isize)),
    Status::GenericFailure,
  )?;
  Ok(result.map(Into::into))
}

#[napi]
pub fn parse_workspace_doc(doc_bin: Buffer) -> Result<Option<NativeWorkspaceDocContent>> {
  let result = map_napi_err(doc_loader::parse_workspace_doc(doc_bin.into()), Status::GenericFailure)?;
  Ok(result.map(Into::into))
}

fn get_block_string(block: &y_octo::Map, key: &str) -> Option<String> {
  match block.get(key)?.to_any()? {
    y_octo::Any::String(s) => Some(s),
    _ => None,
  }
}

fn render_attachment_block_markdown(block: &y_octo::Map) -> String {
  let name = get_block_string(block, "prop:name").unwrap_or_default();
  let source_id = get_block_string(block, "prop:sourceId").unwrap_or_default();
  let label = if name.is_empty() {
    source_id.as_str()
  } else {
    name.as_str()
  };
  let escaped_label = label.replace('\\', "\\\\").replace('[', "\\[").replace(']', "\\]");
  if !source_id.is_empty() {
    format!("\n[{escaped_label}](blob://{source_id})\n\n")
  } else if !label.is_empty() {
    format!("\n{escaped_label}\n\n")
  } else {
    String::new()
  }
}

fn parse_doc_to_markdown_with_attachments(
  doc_bin: Vec<u8>,
  doc_id: String,
  ai_editable: bool,
  doc_url_prefix: Option<String>,
) -> std::result::Result<MarkdownResult, doc_loader::ParseError> {
  let result = doc_loader::parse_doc_to_markdown(
    doc_bin.clone(),
    doc_id.clone(),
    ai_editable,
    doc_url_prefix.clone(),
  )?;
  if !result
    .known_unsupported_blocks
    .iter()
    .any(|entry| entry.ends_with(":affine:attachment"))
  {
    return Ok(result);
  }

  let mut doc = y_octo::DocOptions::new().with_guid(doc_id.clone()).build();
  if doc.apply_update_from_binary_v1(doc_bin).is_err() {
    return Ok(result);
  }
  let Ok(blocks) = doc.get_map("blocks") else {
    return Ok(result);
  };

  let mut replacements: Vec<(String, String)> = Vec::new();
  for entry in &result.known_unsupported_blocks {
    let Some(block_id) = entry.strip_suffix(":affine:attachment") else {
      continue;
    };
    let Some(mut block) = blocks.get(block_id).and_then(|v| v.to_map()) else {
      continue;
    };
    let attachment_md = render_attachment_block_markdown(&block);
    let sentinel_url = format!("__affine_attachment__:{block_id}");
    if block.insert("sys:flavour", "affine:bookmark").is_ok()
      && block.insert("prop:url", sentinel_url).is_ok()
    {
      replacements.push((block_id.to_string(), attachment_md));
    }
  }

  if replacements.is_empty() {
    return Ok(result);
  }

  let Ok(rewritten_bin) = doc.encode_update_v1() else {
    return Ok(result);
  };
  let mut rewritten =
    doc_loader::parse_doc_to_markdown(rewritten_bin, doc_id, ai_editable, doc_url_prefix)?;
  for (block_id, attachment_md) in replacements {
    let ai_bookmark_marker = format!(
      "<!-- block_id={block_id} flavour=affine:bookmark -->\n\n[](Bookmark,__affine_attachment__:{block_id})\n\n"
    );
    if rewritten.markdown.contains(&ai_bookmark_marker) {
      let replacement = if attachment_md.is_empty() {
        String::new()
      } else {
        format!("<!-- block_id={block_id} flavour=affine:attachment -->\n{attachment_md}")
      };
      rewritten.markdown = rewritten.markdown.replacen(&ai_bookmark_marker, &replacement, 1);
      continue;
    }

    let bookmark_marker = format!("\n[](Bookmark,__affine_attachment__:{block_id})\n\n");
    if rewritten.markdown.contains(&bookmark_marker) {
      rewritten.markdown = rewritten.markdown.replacen(&bookmark_marker, &attachment_md, 1);
    } else if !attachment_md.is_empty() {
      rewritten
        .known_unsupported_blocks
        .push(format!("{block_id}:affine:attachment"));
    }
  }

  Ok(rewritten)
}

#[napi]
pub fn parse_doc_to_markdown(
  doc_bin: Buffer,
  doc_id: String,
  ai_editable: Option<bool>,
  doc_url_prefix: Option<String>,
) -> Result<NativeMarkdownResult> {
  let result = map_napi_err(
    parse_doc_to_markdown_with_attachments(
      doc_bin.into(),
      doc_id,
      ai_editable.unwrap_or(false),
      doc_url_prefix,
    ),
    Status::GenericFailure,
  )?;
  Ok(result.into())
}

#[napi]
pub fn read_all_doc_ids_from_root_doc(doc_bin: Buffer, include_trash: Option<bool>) -> Result<Vec<String>> {
  let result = map_napi_err(
    doc_loader::get_doc_ids_from_binary(doc_bin.into(), include_trash.unwrap_or(false)),
    Status::GenericFailure,
  )?;
  Ok(result)
}

/// Converts markdown content to AFFiNE-compatible y-octo document binary.
///
/// # Arguments
/// * `title` - The document title
/// * `markdown` - The markdown content to convert
/// * `doc_id` - The document ID to use for the y-octo doc
///
/// # Returns
/// A Buffer containing the y-octo document update binary
#[napi]
pub fn create_doc_with_markdown(title: String, markdown: String, doc_id: String) -> Result<Buffer> {
  let result = map_napi_err(
    doc_loader::build_full_doc(&title, &markdown, &doc_id),
    Status::GenericFailure,
  )?;
  Ok(Buffer::from(result))
}

/// Updates an existing document with new markdown content.
/// Uses structural diffing to apply block-level replacements for changes.
///
/// # Arguments
/// * `existing_binary` - The current document binary
/// * `new_markdown` - The new markdown content to apply
/// * `doc_id` - The document ID
///
/// # Returns
/// A Buffer containing only the delta (changes) as a y-octo update binary
#[napi]
pub fn update_doc_with_markdown(existing_binary: Buffer, new_markdown: String, doc_id: String) -> Result<Buffer> {
  let result = map_napi_err(
    doc_loader::update_doc(&existing_binary, &new_markdown, &doc_id),
    Status::GenericFailure,
  )?;
  Ok(Buffer::from(result))
}

/// Updates a document's title without touching content blocks.
///
/// # Arguments
/// * `existing_binary` - The current document binary
/// * `title` - The new title
/// * `doc_id` - The document ID
///
/// # Returns
/// A Buffer containing only the delta (changes) as a y-octo update binary
#[napi]
pub fn update_doc_title(existing_binary: Buffer, title: String, doc_id: String) -> Result<Buffer> {
  let result = map_napi_err(
    doc_loader::update_doc_title(&existing_binary, &doc_id, &title),
    Status::GenericFailure,
  )?;
  Ok(Buffer::from(result))
}

/// Updates or creates the docProperties record for a document.
///
/// # Arguments
/// * `existing_binary` - The current docProperties document binary
/// * `properties_doc_id` - The docProperties document ID
///   (db$${workspaceId}$docProperties)
/// * `target_doc_id` - The document ID to update in docProperties
/// * `created_by` - Optional creator user ID
/// * `updated_by` - Optional updater user ID
///
/// # Returns
/// A Buffer containing only the delta (changes) as a y-octo update binary
#[napi]
pub fn update_doc_properties(
  existing_binary: Buffer,
  properties_doc_id: String,
  target_doc_id: String,
  created_by: Option<String>,
  updated_by: Option<String>,
) -> Result<Buffer> {
  let result = map_napi_err(
    doc_loader::update_doc_properties(
      &existing_binary,
      &properties_doc_id,
      &target_doc_id,
      created_by.as_deref(),
      updated_by.as_deref(),
    ),
    Status::GenericFailure,
  )?;
  Ok(Buffer::from(result))
}

/// Adds a document ID to the workspace root doc's meta.pages array.
/// This registers the document in the workspace so it appears in the UI.
///
/// # Arguments
/// * `root_doc_bin` - The current root doc binary (workspaceId doc)
/// * `doc_id` - The document ID to add
/// * `title` - Optional title for the document
///
/// # Returns
/// A Buffer containing the y-octo update binary to apply to the root doc
#[napi]
pub fn add_doc_to_root_doc(root_doc_bin: Buffer, doc_id: String, title: Option<String>) -> Result<Buffer> {
  let result = map_napi_err(
    doc_loader::add_doc_to_root_doc(root_doc_bin.into(), &doc_id, title.as_deref()),
    Status::GenericFailure,
  )?;
  Ok(Buffer::from(result))
}

#[napi]
pub fn build_public_root_doc(root_doc_bin: Buffer, doc_metas: Vec<PublicDocMetaInput>) -> Result<Buffer> {
  let metas = doc_metas
    .iter()
    .map(|meta| (meta.id.as_str(), meta.title.as_deref()))
    .collect::<Vec<_>>();
  let result = map_napi_err(
    doc_loader::build_public_root_doc(&root_doc_bin, &metas),
    Status::GenericFailure,
  )?;
  Ok(Buffer::from(result))
}

/// Updates a document title in the workspace root doc's meta.pages array.
///
/// # Arguments
/// * `root_doc_bin` - The current root doc binary (workspaceId doc)
/// * `doc_id` - The document ID to update
/// * `title` - The new title for the document
///
/// # Returns
/// A Buffer containing the y-octo update binary to apply to the root doc
#[napi]
pub fn update_root_doc_meta_title(root_doc_bin: Buffer, doc_id: String, title: String) -> Result<Buffer> {
  let result = map_napi_err(
    doc_loader::update_root_doc_meta_title(&root_doc_bin, &doc_id, &title),
    Status::GenericFailure,
  )?;
  Ok(Buffer::from(result))
}

#[cfg(test)]
mod tests {
  use y_octo::{DocOptions, Value};

  use super::*;

  #[test]
  fn test_parse_doc_to_markdown_attachment_block() {
    let doc_id = "doc-with-attachment".to_string();
    let doc = DocOptions::new().with_guid(doc_id.clone()).build();
    let mut blocks = doc.get_or_create_map("blocks").unwrap();

    let mut page = doc.create_map().unwrap();
    page.insert("sys:id", "page").unwrap();
    page.insert("sys:flavour", "affine:page").unwrap();
    let mut page_children = doc.create_array().unwrap();
    page_children.push("note").unwrap();
    page.insert("sys:children", Value::Array(page_children)).unwrap();
    let mut page_title = doc.create_text().unwrap();
    page_title.insert(0, "Attachment Test Page").unwrap();
    page.insert("prop:title", Value::Text(page_title)).unwrap();
    blocks.insert("page", Value::Map(page)).unwrap();

    let mut note = doc.create_map().unwrap();
    note.insert("sys:id", "note").unwrap();
    note.insert("sys:flavour", "affine:note").unwrap();
    let mut note_children = doc.create_array().unwrap();
    note_children.push("att1").unwrap();
    note_children.push("att2").unwrap();
    note.insert("sys:children", Value::Array(note_children)).unwrap();
    note.insert("prop:displayMode", "both").unwrap();
    blocks.insert("note", Value::Map(note)).unwrap();

    let mut attachment = doc.create_map().unwrap();
    attachment.insert("sys:id", "att1").unwrap();
    attachment.insert("sys:flavour", "affine:attachment").unwrap();
    attachment
      .insert("sys:children", Value::Array(doc.create_array().unwrap()))
      .unwrap();
    attachment.insert("prop:name", "report]2026.txt").unwrap();
    attachment.insert("prop:sourceId", "blob-source-123").unwrap();
    blocks.insert("att1", Value::Map(attachment)).unwrap();

    let mut missing_source = doc.create_map().unwrap();
    missing_source.insert("sys:id", "att2").unwrap();
    missing_source.insert("sys:flavour", "affine:attachment").unwrap();
    missing_source
      .insert("sys:children", Value::Array(doc.create_array().unwrap()))
      .unwrap();
    missing_source.insert("prop:name", "notes.txt").unwrap();
    blocks.insert("att2", Value::Map(missing_source)).unwrap();

    let doc_bin = doc.encode_update_v1().unwrap();
    let result = parse_doc_to_markdown_with_attachments(doc_bin, doc_id, false, None).expect("parse attachment doc");
    assert_eq!(result.title, "Attachment Test Page");
    assert!(result.markdown.contains("[report\\]2026.txt](blob://blob-source-123)"));
    assert!(result.markdown.contains("\nnotes.txt\n"));
    assert!(!result.markdown.contains("[notes.txt]()"));
    assert!(
      !result
        .known_unsupported_blocks
        .iter()
        .any(|entry| entry.ends_with(":affine:attachment"))
    );
  }
}
