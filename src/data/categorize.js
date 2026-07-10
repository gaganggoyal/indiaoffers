'use strict';

/**
 * Rule-based product categoriser. Maps a deal title to a *primary* leaf category
 * slug (one of the taxonomy leaves under the 5 departments) plus a list of
 * *secondary* SEO categories — extra genuinely-relevant leaves so a deal also
 * surfaces on related category pages (e.g. an air-fryer shows under both
 * "Home & Kitchen" and "TV & Appliances").
 *
 * Deterministic and offline (no API). Rules are ordered most-specific first;
 * the first primary match wins, and home-kitchen is the final fallback so a
 * title is never left uncategorised. Patterns avoid a wrapping \b…\b (which
 * breaks on plural/'+'/digit-ending keywords like "Headphones" or "OnePlus 13").
 */

const { CATEGORY_MAP } = require('./taxonomy');

// Ordered primary rules — first hit wins.
const PRIMARY_RULES = [
  ['automotive',    /car\b|turtle wax|wiper|clear advantage|driver side|flat blade|windshield|dashboard cover|innova|brezza|maruti|motorbike|bike helmet/i],
  ['tools',         /drill|tool kit|hand tool|electrical tester|paint roller|paint kit|diy paint|wall repair|switch pack|impact hammer|broom holder|pull push handle|door handle/i],
  ['beauty',        /facial|face wash|hair straightener|straightener|curler|hair dryer|callus remover|makeup|lipstick|\bserum\b|shampoo|grooming|trimmer/i],
  ['health',        /sanitary pad|whisper|protein (powder|shake|bar|supplement)|whey|multivitamin|glucose|massager|thermometer|nebulizer|first aid/i],
  ['footwear',      /shoes|sneakers|footwear|sandal|slipper|loafer|floater/i],
  ['bags-luggage',  /rucksack|trekking bag|backpack|luggage|suitcase|duffel|trolley bag/i],
  ['sports',        /\bgym\b|dumbbell|treadmill|\byoga\b|fitness|sleeping bag|\bcamp\b|cricket bat|football|badminton/i],
  ['toys',          /\btoys?\b|chess|jigsaw|puzzle|lego|building block|\bdoll\b|kids game/i],
  ['grocery',       /noodles|\batta\b|basmati|masala|namkeen|chocolate|coffee (powder|beans)|green tea|dry fruit|gourmet/i],
  ['tv-appliances', /split ac|air conditioner|refrigerator|washing machine|\btv\b|television|smart tv|microwave|dishwasher|geyser|water heater|chest freezer/i],
  ['computers',     /laptop|notebook|macbook|ideapad|thinkpad|vivobook|omnibook|primebook|chromebook|\btablet\b|\bpad\b|\btab\b|\bssd\b|nvme|hard disk|pen ?drive/i],
  ['electronics',   /headphone|soundbar|\bspeaker|home theatre|home theater|noise cancel|dolby|subwoofer|\bcamera\b|dslr|mirrorless|\balpha\b|\beos\b|nikon|smartwatch|projector|printer/i],
  ['mobiles',       /smartphone|\b5g\b|iphone|galaxy [msza]|redmi|realme|oneplus\s*\d|\bnord\b|iqoo|earbuds|\bbuds\b|earphones|neckband|\btws\b|power ?bank|fast charger|\bcharger\b|type[- ]?c cable|braided.*cable|phone stand|mobile stand|selfie stick|\botg\b/i],
  ['furniture',     /sofa|dining table|coffee table|nesting table|wardrobe|office chair|arm chair|\bchairs?\b|book\s?shelf|bookcase|\bcabinet\b|study table|bed with box|size bed with|storage bed|sheesham wood|\d\s*seater/i],
  ['fashion',       /blazer|\bshirt\b|t-shirt|tshirt|jeans|trouser|kurta|saree|\bsari\b|\bdress\b|apparel|socks|myntra|clothing|innerwear/i],
];

// Secondary SEO tags — each rule adds its slug when the pattern matches (and it
// differs from the primary). Keeps genuinely-relevant thin categories populated.
const SECONDARY_RULES = [
  ['tv-appliances', /air fryer|\bmixer\b|grinder|electric kettle|induction|chopper|juicer|microwave|otg oven|toaster/i],
  ['home-kitchen',  /air fryer|cookware|kadhai|frying pan|pressure cooker|\bkettle\b/i],
  ['travel',        /rucksack|trekking|sleeping bag|\bcamp\b|duffel|trolley bag|suitcase/i],
  ['bags-luggage',  /rucksack|trekking bag|backpack|duffel/i],
  ['sports',        /sleeping bag|\bcamp\b|running shoes/i],
  ['health',        /\bgym\b|dumbbell|fitness|facial|callus|massager/i],
  ['garden',        /\bgarden\b|planter|\bplant\b|outdoor|\blawn\b/i],
  ['watches',       /smartwatch|smart watch|\bwatch\b/i],
  ['electronics',   /earbuds|\btws\b|neckband|earphones|bluetooth/i],
  ['mobiles',       /headphone|earbuds|power ?bank|\bcharger\b|\btablet\b|\bpad\b/i],
  ['baby',          /\bbaby\b|infant|diaper|\bkids\b|toddler/i],
];

function categorize(title) {
  const t = ` ${String(title || '')} `;

  let primary = '';
  for (const [cat, rx] of PRIMARY_RULES) {
    if (rx.test(t)) { primary = cat; break; }
  }
  if (!primary) primary = 'home-kitchen'; // sensible fallback for home/decor items

  const seo = new Set();
  for (const [cat, rx] of SECONDARY_RULES) {
    if (cat !== primary && CATEGORY_MAP[cat] && rx.test(t)) seo.add(cat);
  }
  seo.delete(primary);

  return { primary, seo: [...seo] };
}

module.exports = { categorize };
