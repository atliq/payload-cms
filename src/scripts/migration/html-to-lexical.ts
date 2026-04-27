import { randomBytes } from 'crypto'
import { JSDOM } from 'jsdom'
import type { IdMaps } from './id-map'

interface LexicalNode {
  type: string
  version: number
  [key: string]: any
}

interface LexicalTextNode extends LexicalNode {
  type: 'text'
  text: string
  format: number
  detail: number
  mode: string
  style: string
}

const FORMAT = {
  BOLD: 1,
  ITALIC: 2,
  STRIKETHROUGH: 4,
  UNDERLINE: 8,
  CODE: 16,
  SUBSCRIPT: 32,
  SUPERSCRIPT: 64,
}

const DIRECTUS_ASSET_REGEX = /wp-api\.atliq\.com\/assets\/([a-f0-9-]{36})/i

function generateNodeId(): string {
  return randomBytes(12).toString('hex')
}

function extractDirectusUuid(src: string): string | null {
  const match = src.match(DIRECTUS_ASSET_REGEX)
  return match ? match[1] : null
}

function createTextNode(text: string, format: number = 0): LexicalTextNode {
  return {
    type: 'text',
    version: 1,
    text,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
  }
}

function createParagraphNode(children: LexicalNode[]): LexicalNode {
  return {
    type: 'paragraph',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
  }
}

function createHeadingNode(tag: string, children: LexicalNode[]): LexicalNode {
  return {
    type: 'heading',
    version: 1,
    tag,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  }
}

function createLinkNode(url: string, children: LexicalNode[]): LexicalNode {
  return {
    type: 'link',
    version: 3,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    fields: {
      linkType: 'custom',
      newTab: false,
      url,
    },
  }
}

function createListNode(tag: 'ul' | 'ol', children: LexicalNode[]): LexicalNode {
  return {
    type: 'list',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    listType: tag === 'ol' ? 'number' : 'bullet',
    start: 1,
    tag,
  }
}

function createListItemNode(children: LexicalNode[]): LexicalNode {
  return {
    type: 'listitem',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    value: 1,
  }
}

function createQuoteNode(children: LexicalNode[]): LexicalNode {
  return {
    type: 'quote',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  }
}

function createLineBreakNode(): LexicalNode {
  return { type: 'linebreak', version: 1 }
}

function createHorizontalRuleNode(): LexicalNode {
  return { type: 'horizontalrule', version: 1 }
}

function createUploadNode(payloadMediaId: number): LexicalNode {
  return {
    type: 'upload',
    version: 3,
    id: generateNodeId(),
    format: '',
    fields: null,
    relationTo: 'media',
    value: payloadMediaId,
  }
}

function getUploadNodeFromImg(el: Element, idMaps: IdMaps | undefined): LexicalNode | null {
  if (!idMaps) return null
  const src = el.getAttribute('src') || ''
  const uuid = extractDirectusUuid(src)
  if (!uuid) return null
  const payloadId = idMaps.media.get(uuid)
  if (payloadId === undefined) return null
  return createUploadNode(payloadId)
}

function getFormatFromTag(tagName: string): number {
  switch (tagName) {
    case 'STRONG':
    case 'B':
      return FORMAT.BOLD
    case 'EM':
    case 'I':
      return FORMAT.ITALIC
    case 'U':
      return FORMAT.UNDERLINE
    case 'S':
    case 'DEL':
    case 'STRIKE':
      return FORMAT.STRIKETHROUGH
    case 'CODE':
      return FORMAT.CODE
    case 'SUB':
      return FORMAT.SUBSCRIPT
    case 'SUP':
      return FORMAT.SUPERSCRIPT
    default:
      return 0
  }
}

function convertInlineNodes(
  node: Node,
  parentFormat: number = 0,
  idMaps?: IdMaps,
): LexicalNode[] {
  const nodes: LexicalNode[] = []

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      // Text node
      const text = child.textContent || ''
      if (text) {
        nodes.push(createTextNode(text, parentFormat))
      }
    } else if (child.nodeType === 1) {
      const el = child as Element
      const tag = el.tagName

      if (tag === 'BR') {
        nodes.push(createLineBreakNode())
        continue
      }

      if (tag === 'A') {
        const href = el.getAttribute('href') || '#'
        const linkChildren = convertInlineNodes(el, parentFormat, idMaps)
        nodes.push(createLinkNode(href, linkChildren))
        continue
      }

      if (tag === 'IMG') {
        // IMG is block-level in Lexical — skip in inline context
        // (block callers handle IMG extraction separately)
        continue
      }

      const format = getFormatFromTag(tag)
      if (format) {
        nodes.push(...convertInlineNodes(el, parentFormat | format, idMaps))
      } else {
        nodes.push(...convertInlineNodes(el, parentFormat, idMaps))
      }
    }
  }

  return nodes
}

// Extracts upload nodes for any direct IMG children of the element.
function extractImgUploadNodes(node: Element, idMaps: IdMaps | undefined): LexicalNode[] {
  if (!idMaps) return []
  const uploads: LexicalNode[] = []
  for (const child of Array.from(node.children)) {
    if (child.tagName === 'IMG') {
      const uploadNode = getUploadNodeFromImg(child, idMaps)
      if (uploadNode) uploads.push(uploadNode)
    }
  }
  return uploads
}

function convertBlockNode(node: Element, idMaps?: IdMaps): LexicalNode[] {
  const tag = node.tagName
  const nodes: LexicalNode[] = []

  switch (tag) {
    case 'IMG': {
      const uploadNode = getUploadNodeFromImg(node, idMaps)
      if (uploadNode) nodes.push(uploadNode)
      break
    }

    case 'P': {
      const imgUploads = extractImgUploadNodes(node, idMaps)
      const children = convertInlineNodes(node, 0, idMaps)
      if (children.length > 0) {
        nodes.push(createParagraphNode(children))
      }
      nodes.push(...imgUploads)
      break
    }

    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const children = convertInlineNodes(node, 0, idMaps)
      if (children.length > 0) {
        nodes.push(createHeadingNode(tag.toLowerCase(), children))
      }
      break
    }

    case 'UL':
    case 'OL': {
      const listItems: LexicalNode[] = []
      for (const li of Array.from(node.children)) {
        if (li.tagName === 'LI') {
          const liChildren = convertInlineNodes(li, 0, idMaps)
          if (liChildren.length > 0) {
            listItems.push(createListItemNode(liChildren))
          }
        }
      }
      if (listItems.length > 0) {
        nodes.push(createListNode(tag.toLowerCase() as 'ul' | 'ol', listItems))
      }
      break
    }

    case 'BLOCKQUOTE': {
      const children = convertInlineNodes(node, 0, idMaps)
      if (children.length > 0) {
        nodes.push(createQuoteNode(children))
      }
      break
    }

    case 'HR': {
      nodes.push(createHorizontalRuleNode())
      break
    }

    case 'PRE': {
      const codeText = node.textContent || ''
      nodes.push(createParagraphNode([createTextNode(codeText, FORMAT.CODE)]))
      break
    }

    case 'TABLE': {
      const text = node.textContent?.trim() || ''
      if (text) {
        nodes.push(createParagraphNode([createTextNode(text)]))
      }
      break
    }

    case 'DIV':
    case 'SECTION':
    case 'ARTICLE':
    case 'MAIN':
    case 'HEADER':
    case 'FOOTER':
    case 'FIGURE':
    case 'FIGCAPTION':
    case 'SPAN': {
      for (const child of Array.from(node.children)) {
        nodes.push(...convertBlockNode(child, idMaps))
      }
      if (nodes.length === 0) {
        const inline = convertInlineNodes(node, 0, idMaps)
        if (inline.length > 0) {
          nodes.push(createParagraphNode(inline))
        }
      }
      break
    }

    default: {
      const children = convertInlineNodes(node, 0, idMaps)
      if (children.length > 0) {
        nodes.push(createParagraphNode(children))
      }
      break
    }
  }

  return nodes
}

export function htmlToLexical(html: string, idMaps?: IdMaps): any | null {
  if (!html || !html.trim()) return null

  try {
    const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`)
    const body = dom.window.document.body

    const children: LexicalNode[] = []

    for (const node of Array.from(body.childNodes)) {
      if (node.nodeType === 3) {
        const text = node.textContent?.trim() || ''
        if (text) {
          children.push(createParagraphNode([createTextNode(text)]))
        }
      } else if (node.nodeType === 1) {
        children.push(...convertBlockNode(node as Element, idMaps))
      }
    }

    if (children.length === 0) {
      return null
    }

    return {
      root: {
        type: 'root',
        version: 1,
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
      },
    }
  } catch (error) {
    console.error('HTML to Lexical conversion failed:', error)
    return null
  }
}
