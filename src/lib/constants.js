// Fixed display order for item categories. Anything not listed here falls to the end.
export const CATEGORY_ORDER = [
  "Proteins/Mains",
  "Sauces/Bases",
  "Pantry/Condiments",
  "Misc",
];

export const KITCHEN_NAME = "Bukit Jalil";

export function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function groupByCategory(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.category || "Misc";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return sortCategories([...map.keys()]).map((category) => ({
    category,
    items: map.get(category),
  }));
}
