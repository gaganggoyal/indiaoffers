'use strict';

/**
 * Single source of truth for product categories, organised as a 3-level tree:
 *   parent department  →  sub-group  →  leaf category (what a deal is tagged with).
 *
 * Deals, the admin deal form and the seeder all use the *leaf* slugs (unchanged),
 * so nothing downstream breaks. The tree is used for the homepage "Shop by
 * Category" view, grouped dropdowns and descendant-aware filtering on /deals.
 *
 * Parent/sub-group slugs are namespaced (`dept-…`, `grp-…`) so they can never
 * collide with a leaf slug.
 */

const CATEGORY_TREE = [
  { slug: 'dept-electronics', name: 'Electronics', icon: '🔌', children: [
    { slug: 'grp-mobiles-computers', name: 'Mobiles & Computers', icon: '📱', children: [
      { slug: 'mobiles',     name: 'Mobiles & Accessories', icon: '📱' },
      { slug: 'computers',   name: 'Computers & Laptops',   icon: '💻' }
    ] },
    { slug: 'grp-tv-audio', name: 'TV, Audio & Gadgets', icon: '📺', children: [
      { slug: 'tv-appliances', name: 'TV & Appliances', icon: '📺' },
      { slug: 'electronics',   name: 'Audio & Electronics', icon: '🎧' }
    ] },
    { slug: 'grp-gaming', name: 'Gaming', icon: '🎮', children: [
      { slug: 'video-games', name: 'Video Games', icon: '🎮' }
    ] }
  ] },

  { slug: 'dept-fashion', name: 'Fashion & Beauty', icon: '👗', children: [
    { slug: 'grp-clothing', name: 'Clothing & Footwear', icon: '👕', children: [
      { slug: 'fashion',  name: 'Clothing & Fashion', icon: '👗' },
      { slug: 'footwear', name: 'Footwear',           icon: '👟' }
    ] },
    { slug: 'grp-accessories', name: 'Accessories', icon: '⌚', children: [
      { slug: 'watches',      name: 'Watches',        icon: '⌚' },
      { slug: 'jewellery',    name: 'Jewellery',      icon: '💍' },
      { slug: 'bags-luggage', name: 'Bags & Luggage', icon: '🎒' }
    ] },
    { slug: 'grp-beauty', name: 'Beauty & Grooming', icon: '💄', children: [
      { slug: 'beauty', name: 'Beauty & Personal Care', icon: '💄' }
    ] }
  ] },

  { slug: 'dept-home', name: 'Home & Living', icon: '🏠', children: [
    { slug: 'grp-home-kitchen', name: 'Home & Kitchen', icon: '🍳', children: [
      { slug: 'home-kitchen', name: 'Home & Kitchen', icon: '🏠' },
      { slug: 'furniture',    name: 'Furniture',      icon: '🛋️' }
    ] },
    { slug: 'grp-outdoors', name: 'Garden & Tools', icon: '🔧', children: [
      { slug: 'garden', name: 'Garden & Outdoors',        icon: '🌱' },
      { slug: 'tools',  name: 'Home Improvement & Tools', icon: '🔧' }
    ] },
    { slug: 'grp-pets', name: 'Pets', icon: '🐾', children: [
      { slug: 'pet-supplies', name: 'Pet Supplies', icon: '🐾' }
    ] }
  ] },

  { slug: 'dept-daily', name: 'Grocery & Daily Needs', icon: '🛒', children: [
    { slug: 'grp-grocery', name: 'Grocery & Food', icon: '🛒', children: [
      { slug: 'grocery',     name: 'Grocery & Gourmet', icon: '🛒' },
      { slug: 'food-dining', name: 'Food & Dining',     icon: '🍔' }
    ] },
    { slug: 'grp-health', name: 'Health, Baby & Kids', icon: '💊', children: [
      { slug: 'health', name: 'Health & Nutrition', icon: '💊' },
      { slug: 'baby',   name: 'Baby & Kids',        icon: '🍼' },
      { slug: 'toys',   name: 'Toys & Games',       icon: '🧸' }
    ] }
  ] },

  { slug: 'dept-lifestyle', name: 'Lifestyle & More', icon: '🎯', children: [
    { slug: 'grp-sports-auto', name: 'Sports & Auto', icon: '🏏', children: [
      { slug: 'sports',     name: 'Sports & Fitness', icon: '🏏' },
      { slug: 'automotive', name: 'Car & Motorbike',  icon: '🚗' }
    ] },
    { slug: 'grp-hobbies', name: 'Books & Hobbies', icon: '📚', children: [
      { slug: 'books',      name: 'Books',                icon: '📚' },
      { slug: 'stationery', name: 'Office & Stationery',  icon: '✏️' },
      { slug: 'music',      name: 'Musical Instruments',  icon: '🎸' }
    ] },
    { slug: 'grp-travel', name: 'Travel & Entertainment', icon: '✈️', children: [
      { slug: 'travel',        name: 'Travel & Hotels',    icon: '✈️' },
      { slug: 'entertainment', name: 'OTT & Entertainment', icon: '🎬' }
    ] }
  ] },
];

// Flatten the tree to the ordered list of leaf categories (backward compatible
// with everything that consumed the old flat CATEGORIES array).
const CATEGORIES = [];
// Grouped options for <select> / searchable dropdowns: one group per sub-group,
// labelled "Department ▸ Sub-group".
const CATEGORY_GROUPS = [];
for (const dept of CATEGORY_TREE) {
  for (const grp of dept.children) {
    const options = grp.children.map(leaf => {
      CATEGORIES.push(leaf);
      return leaf;
    });
    CATEGORY_GROUPS.push({ label: `${dept.name} ▸ ${grp.name}`, icon: grp.icon, options });
  }
}

const CATEGORY_SLUGS = CATEGORIES.map(c => c.slug);
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));

// name/icon lookups kept for legacy `catIcons[slug]` / label usage in views
const CAT_ICONS = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.icon]));
const CAT_NAMES = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.name]));

// Find any node (leaf, sub-group or department) by slug.
function findNode(slug) {
  for (const dept of CATEGORY_TREE) {
    if (dept.slug === slug) return dept;
    for (const grp of dept.children) {
      if (grp.slug === slug) return grp;
      for (const leaf of grp.children) if (leaf.slug === slug) return leaf;
    }
  }
  return null;
}

// Display name for any slug (leaf, sub-group or department).
const categoryName = slug => { const n = findNode(slug); return n ? n.name : (slug || ''); };

// All leaf slugs under a node. A leaf resolves to itself; a branch resolves to
// every leaf beneath it — so /deals?category=dept-electronics works too.
function descendantSlugs(slug) {
  const node = findNode(slug);
  if (!node) return [];
  if (!node.children) return [node.slug];
  const out = [];
  const walk = n => n.children ? n.children.forEach(walk) : out.push(n.slug);
  walk(node);
  return out;
}

module.exports = {
  CATEGORY_TREE, CATEGORIES, CATEGORY_GROUPS,
  CATEGORY_SLUGS, CATEGORY_MAP, CAT_ICONS, CAT_NAMES,
  categoryName, findNode, descendantSlugs
};
