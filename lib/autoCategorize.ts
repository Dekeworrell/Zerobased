/**
 * Client-side auto-categorization
 * Maps merchant names / transaction labels to Zerobased budget category IDs.
 * Used when manually editing imported transactions or as a suggestion engine.
 */

type Rule = {
  pattern: RegExp
  categoryId: string
}

// Rules are checked in order — first match wins.
const RULES: Rule[] = [
  // Groceries
  { pattern: /\b(walmart|superstore|safeway|sobeys|loblaws|no frills|metro|iga|save on foods|t&t|whole foods|costco|freshco|farm boy|longos|co-op)\b/i, categoryId: 'groceries' },

  // Dining / restaurants
  { pattern: /\b(mcdonald|tim hortons|starbucks|subway|pizza|sushi|thai|burger|a&w|wendy|kfc|popeyes|chipotle|harveys|mary brown|swiss chalet|east side|boston pizza|the keg|restaurant|cafe|eatery|diner|grill|pub|bar)\b/i, categoryId: 'dining' },

  // Fuel
  { pattern: /\b(petro-canada|shell|esso|husky|chevron|pioneer|ultramar|gas station|fuel|petro can)\b/i, categoryId: 'fuel' },

  // Transport
  { pattern: /\b(uber|lyft|presto|transit|ttc|stm|oc transpo|compass card|parking|impark|greenp|taxi|grab)\b/i, categoryId: 'transport' },

  // Vehicle maintenance
  { pattern: /\b(canadian tire|mr lube|jiffy lube|oil change|midas|meineke|napa|autopart|active green|speedy auto|mechanic|tire|brakes)\b/i, categoryId: 'vehicle_maintenance' },

  // Phone
  { pattern: /\b(telus|bell|rogers|fido|koodo|freedom|virgin mobile|public mobile|chatr|wind mobile)\b/i, categoryId: 'phone' },

  // Internet / cable
  { pattern: /\b(shaw|videotron|cogeco|eastlink|teksavvy|start internet|cable|internet)\b/i, categoryId: 'internet' },

  // Utilities
  { pattern: /\b(hydro|enmax|bc hydro|ontario hydro|direct energy|alectra|fortis|epcor|atco|hydro one|union gas|enbridge|natural gas|electricity|utility)\b/i, categoryId: 'utilities' },

  // Fitness
  { pattern: /\b(goodlife|ymca|anytime fitness|planet fitness|crunch|equinox|la fitness|snap fitness|gym|crossfit|yoga|pilates|boxing|swim)\b/i, categoryId: 'fitness' },

  // Health / pharmacy
  { pattern: /\b(shoppers|rexall|london drugs|jean coutu|uniprix|pharmasave|guardian|pharmacy|dentist|dental|optometrist|physiotherapy|chiropractic|clinic|hospital|medical|doctor|md|rx)\b/i, categoryId: 'health' },

  // Subscriptions / streaming
  { pattern: /\b(netflix|spotify|apple|google play|amazon prime|disney|crave|paramount|tubi|youtube premium|adobe|microsoft|dropbox|slack|notion|subscription)\b/i, categoryId: 'subscriptions' },

  // Entertainment
  { pattern: /\b(cineplex|landmark cinema|imax|theatre|theater|concert|ticketmaster|stubhub|eventbrite|museum|zoo|aquarium|entertainment|steam|playstation|xbox|nintendo)\b/i, categoryId: 'entertainment' },

  // Clothing
  { pattern: /\b(h&m|zara|gap|old navy|banana republic|the bay|winners|marshalls|nordstrom|aritzia|lulu|uniqlo|reitmans|rw&co|bootlegger|bluenotes|forever 21|clothing|apparel|fashion)\b/i, categoryId: 'clothing' },

  // Pets
  { pattern: /\b(pet smart|petsmart|petco|pet value|global pet|vet|veterinarian|animal hospital|pet supplies)\b/i, categoryId: 'pets' },

  // Education
  { pattern: /\b(tuition|university|college|udemy|coursera|skillshare|lynda|book|chapters|indigo|textbook)\b/i, categoryId: 'education' },

  // Sports
  { pattern: /\b(sport chek|atmosphere|sail|bass pro|cabela|rei|golf|hockey|skating|soccer|basketball|tennis|baseball|curling)\b/i, categoryId: 'sports' },

  // Savings / investments (transfers to savings accounts — label as savings)
  { pattern: /\b(tfsa|rrsp|fhsa|resp|investment|wealthsimple|questrade|qtrade|etf|mutual fund|savings transfer)\b/i, categoryId: 'savings' },

  // Mortgage / rent
  { pattern: /\b(mortgage|rent|strata|condo fee|maintenance fee|property management)\b/i, categoryId: 'mortgage' },

  // Insurance
  { pattern: /\b(insurance|intact|aviva|td insurance|belairdirect|wawanesa|allstate|desjardins insurance|manulife|sun life|great-west|canada life)\b/i, categoryId: 'home_insurance' },
]

/**
 * Suggest a budget category ID from a transaction label / merchant name.
 * Returns null if no rule matches.
 */
export function suggestCategory(label: string): string | null {
  if (!label) return null
  for (const rule of RULES) {
    if (rule.pattern.test(label)) return rule.categoryId
  }
  return null
}

/**
 * Resolve a suggested categoryId to an actual UUID from the user's budget categories.
 * budgetCats is the list returned from Supabase: { id, label }[]
 */
export function resolveCategory(
  suggested: string | null,
  budgetCats: { id: string; label: string }[]
): string | null {
  if (!suggested) return null
  // The suggested string is an EXPENSE_CATEGORIES id (e.g. 'groceries').
  // Match it against the label of the user's actual budget categories.
  const labelMap: Record<string, string> = {
    groceries: 'groceries',
    dining: 'dining out',
    fuel: 'fuel',
    transport: 'transport',
    vehicle_maintenance: 'vehicle maintenance',
    phone: 'phone',
    internet: 'internet',
    utilities: 'utilities',
    fitness: 'fitness',
    health: 'health',
    subscriptions: 'subscriptions',
    entertainment: 'entertainment',
    clothing: 'clothing',
    pets: 'pets',
    education: 'education',
    sports: 'sports',
    savings: 'savings',
    mortgage: 'mortgage/rent',
    home_insurance: 'home insurance',
  }

  const targetLabel = labelMap[suggested] ?? suggested
  const match = budgetCats.find(c =>
    c.label.toLowerCase().includes(targetLabel.toLowerCase()) ||
    targetLabel.toLowerCase().includes(c.label.toLowerCase())
  )
  return match?.id ?? null
}
