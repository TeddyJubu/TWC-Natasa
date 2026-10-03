# Member directory and homepage reorganization

## Goal
Create ten clearly fictional Women’s Collective members with cohesive editorial portraits and useful professional details, then give them a focused home without overcrowding the main page.

## Build
- Generate ten distinct, polished portraits that share the site’s natural, editorial photography direction.
- Add typed member data covering name, role, business, neighborhood, specialty, short biography, and collaboration interests.
- Build a reusable, accessible `MemberCard` with compact and featured variants and export it through the design-system barrel.
- Add a dedicated `/members` directory with an editorial introduction, filter controls, and a responsive ten-profile grid.
- Replace the repeated homepage portrait strip with a curated member preview and a clear link to the full directory.
- Add “Members” to relevant navigation while preserving the existing mission, constellation, membership, and application flow.

## Verification
- Check all ten portraits, names, details, filters, and links.
- Verify desktop and mobile layouts, text fit, image crops, focus states, and reduced motion.
- Confirm route metadata and a clean build.

## Technical notes
Member assets and reusable code will stay inside the self-contained design-system subtree so attached projects receive them. All demo identities will be labeled fictional in the directory context.
