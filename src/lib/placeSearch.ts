import type { CampusPlace } from "../data/places";

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type TreeNode = {
  children: Map<string, TreeNode>;
  placeIds: Set<string>;
};

class PrefixTree {
  private readonly root: TreeNode = { children: new Map(), placeIds: new Set() };

  add(value: string, placeId: string): void {
    let node = this.root;
    for (const character of value) {
      let next = node.children.get(character);
      if (!next) {
        next = { children: new Map(), placeIds: new Set() };
        node.children.set(character, next);
      }
      node = next;
    }
    node.placeIds.add(placeId);
  }

  findPrefix(value: string): Set<string> {
    let node = this.root;
    for (const character of value) {
      const next = node.children.get(character);
      if (!next) return new Set();
      node = next;
    }
    const matches = new Set<string>();
    const collect = (branch: TreeNode) => {
      branch.placeIds.forEach((id) => matches.add(id));
      for (const child of branch.children.values()) {
        collect(child);
      }
    };
    collect(node);
    return matches;
  }
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

const placeTerms = (place: CampusPlace) =>
  [place.name, ...place.aliases].map(normalize).filter(Boolean);

export function createPlaceSearch(places: CampusPlace[]) {
  const tree = new PrefixTree();
  const terms = new Map(places.map((place) => [place.id, placeTerms(place)]));
  for (const place of places) {
    for (const term of terms.get(place.id) ?? []) tree.add(term, place.id);
  }

  return (query: string): CampusPlace[] => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    const exactMatches = places.filter((place) =>
      terms.get(place.id)?.includes(normalizedQuery),
    );
    if (exactMatches.length > 0) return exactMatches.slice(0, 6);

    const prefixMatches = tree.findPrefix(normalizedQuery);
    const queryWords = normalizedQuery.split(" ");
    return places
      .map((place) => {
        const candidates = terms.get(place.id) ?? [];
        const score = Math.min(
          ...candidates.map((term) => {
            if (term === normalizedQuery) return 0;
            if (term.startsWith(normalizedQuery)) return 0.08;
            if (term.includes(normalizedQuery)) return 0.18;
            const words = term.split(" ");
            const distance = Math.min(
              editDistance(normalizedQuery, term) / Math.max(normalizedQuery.length, term.length),
              ...queryWords.map((word) =>
                Math.min(
                  ...words.map(
                    (candidate) =>
                      editDistance(word, candidate) / Math.max(word.length, candidate.length),
                  ),
                ),
              ),
            );
            return distance;
          }),
        );
        const boostedScore = prefixMatches.has(place.id) ? Math.min(score, 0.08) : score;
        return { place, score: boostedScore };
      })
      .filter(({ score }) =>
        normalizedQuery.length <= 3 ? score <= 0.08 : score <= 0.34,
      )
      .sort((left, right) => left.score - right.score)
      .slice(0, 6)
      .map(({ place }) => place);
  };
}
