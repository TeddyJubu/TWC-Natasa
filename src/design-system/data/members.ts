import amaraImage from "../assets/photography/member-amara.jpg";
import claireImage from "../assets/photography/member-claire.jpg";
import deniseImage from "../assets/photography/member-denise.jpg";
import elenaImage from "../assets/photography/member-elena.jpg";
import laylaImage from "../assets/photography/member-layla.jpg";
import minaImage from "../assets/photography/member-mina.jpg";
import naomiImage from "../assets/photography/member-naomi.jpg";
import priyaImage from "../assets/photography/member-priya.jpg";
import simoneImage from "../assets/photography/member-simone.jpg";
import thaoImage from "../assets/photography/member-thao.jpg";

export interface MemberProfile {
  id: string;
  name: string;
  role: string;
  business: string;
  neighborhood: string;
  specialty: string;
  bio: string;
  lookingFor: string;
  image: string;
  imageAlt: string;
}

/**
 * Fictional profiles for directory prototypes and design-system demonstrations.
 * Replace these records with approved member information before launch.
 */
export const demoMembers: MemberProfile[] = [
  {
    id: "amara-singh",
    name: "Amara Singh",
    role: "Ceramic Artist & Founder",
    business: "Soft Earth Studio",
    neighborhood: "Long Island City",
    specialty: "Art & craft",
    bio: "Amara makes small-batch tableware inspired by everyday rituals and teaches welcoming weekend workshops for first-time makers.",
    lookingFor: "Retail partnerships and creative collaborators",
    image: amaraImage,
    imageAlt: "Amara Singh in her sunlit ceramics studio",
  },
  {
    id: "simone-brooks",
    name: "Simone Brooks",
    role: "Architect & Principal",
    business: "Common Ground Architecture",
    neighborhood: "Astoria",
    specialty: "Architecture & design",
    bio: "Simone designs thoughtful homes and neighborhood spaces with an emphasis on adaptive reuse, daylight, and lasting materials.",
    lookingFor: "Local makers, developers, and community projects",
    image: simoneImage,
    imageAlt: "Simone Brooks in her architecture studio",
  },
  {
    id: "mina-park",
    name: "Mina Park",
    role: "Baker & Owner",
    business: "Morning Table",
    neighborhood: "Sunnyside",
    specialty: "Food & hospitality",
    bio: "Mina brings Korean flavors and New York baking traditions together in a neighborhood bakery built around generous mornings.",
    lookingFor: "Event partners and independent retailers",
    image: minaImage,
    imageAlt: "Mina Park in her neighborhood bakery",
  },
  {
    id: "elena-cruz",
    name: "Elena Cruz",
    role: "Floral Designer",
    business: "Field Note Flowers",
    neighborhood: "Jackson Heights",
    specialty: "Events & florals",
    bio: "Elena creates loose, seasonal arrangements for gatherings and celebrations, sourcing from regional growers whenever possible.",
    lookingFor: "Event planners, venues, and photographers",
    image: elenaImage,
    imageAlt: "Elena Cruz arranging seasonal flowers",
  },
  {
    id: "claire-morgan",
    name: "Claire Morgan",
    role: "Publisher & Creative Director",
    business: "Side Street Editions",
    neighborhood: "Forest Hills",
    specialty: "Publishing & storytelling",
    bio: "Claire helps independent writers and artists turn complex ideas into beautifully edited books, journals, and printed objects.",
    lookingFor: "Writers, illustrators, and cultural partners",
    image: claireImage,
    imageAlt: "Claire Morgan among books and printed proofs",
  },
  {
    id: "layla-haddad",
    name: "Layla Haddad",
    role: "Movement Educator & Founder",
    business: "Open Room Practice",
    neighborhood: "Astoria",
    specialty: "Wellness & movement",
    bio: "Layla leads practical movement classes that help busy women build strength, ease, and a more sustainable relationship with rest.",
    lookingFor: "Workplace programs and wellness collaborations",
    image: laylaImage,
    imageAlt: "Layla Haddad in her light-filled movement studio",
  },
  {
    id: "thao-nguyen",
    name: "Thao Nguyen",
    role: "Product Designer & Founder",
    business: "Good Measure Objects",
    neighborhood: "Long Island City",
    specialty: "Product & digital design",
    bio: "Thao designs playful, useful objects and digital experiences for small teams that care deeply about how things feel and work.",
    lookingFor: "Values-led founders and fabrication partners",
    image: thaoImage,
    imageAlt: "Thao Nguyen in her colorful design workshop",
  },
  {
    id: "denise-walker",
    name: "Denise Walker",
    role: "Community Strategist",
    business: "Neighborly Practice",
    neighborhood: "Elmhurst",
    specialty: "Community & nonprofit",
    bio: "Denise helps mission-led organizations listen well, build trust, and create programs shaped with—not simply for—their communities.",
    lookingFor: "Nonprofit leaders and civic collaborators",
    image: deniseImage,
    imageAlt: "Denise Walker on a leafy Queens street",
  },
  {
    id: "naomi-reed",
    name: "Naomi Reed",
    role: "Fashion Designer & Founder",
    business: "Second Season",
    neighborhood: "Rego Park",
    specialty: "Fashion & sustainability",
    bio: "Naomi creates limited-run clothing from traceable natural fibers and recovered textiles, designed to be worn for years.",
    lookingFor: "Stylists, responsible suppliers, and stockists",
    image: naomiImage,
    imageAlt: "Naomi Reed in her textile atelier",
  },
  {
    id: "priya-mehta",
    name: "Priya Mehta",
    role: "Financial Educator",
    business: "Plainspoken Money",
    neighborhood: "Forest Hills",
    specialty: "Finance & education",
    bio: "Priya gives independent professionals clear, shame-free systems for pricing, cash flow, and building a financially resilient business.",
    lookingFor: "Workshop hosts and founder communities",
    image: priyaImage,
    imageAlt: "Priya Mehta at her workspace in Queens",
  },
];