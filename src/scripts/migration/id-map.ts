export interface IdMaps {
  categories: Map<number, number>
  authors: Map<number, number>
  posts: Map<number, number>
  culturePosts: Map<number, number>
  media: Map<string, number>
}

export function createIdMaps(): IdMaps {
  return {
    categories: new Map(),
    authors: new Map(),
    posts: new Map(),
    culturePosts: new Map(),
    media: new Map(),
  }
}
