# Membership form and system-wide motion

## Goal
Rebuild the current application specimen as a complete, long-form membership application based on the referenced flow, while preserving Bloom’s visual identity. Extend the same editorial motion language across every component and showcase page.

## Form work
- Add any missing reusable primitives needed by the reference: multi-select checkbox groups, consent panels, grouped radio choices, conditional follow-up areas, required/optional treatment, progress/navigation, privacy notice, signature, and upload states.
- Replace the short three-panel sample with a complete ten-section membership application covering profile, work, community, member features, directory, media permissions, events, communication, guidelines, and signature.
- Keep the reference’s clear single-column hierarchy and dense field coverage, translated into Bloom’s Gilda Display, Inter, token palette, editorial numbering, and responsive spacing.
- Make conditional questions respond to selections, retain accessible labels/descriptions, and provide a polished submission confirmation without adding persistence.

## Motion work
- Apply shared entrance, stagger, hover, focus, expand/collapse, tab-change, image, ribbon, navigation, and form-state transitions across the library.
- Use motion tokens and reusable utilities rather than one-off timing values.
- Keep movement restrained and editorial, with full `prefers-reduced-motion` fallbacks and no layout-shifting animation.

## Library contract
- Export every new primitive from the barrel and add it to the gallery.
- Update component documentation metadata and system guidance for the expanded APIs.
- Keep all runtime library code self-contained under the design-system directory.

## Verification
- Verify the full application and all showcase routes at desktop and mobile sizes.
- Test keyboard focus, conditional fields, choice controls, accordion/tab transitions, submission state, reduced motion, overflow, console errors, and build health.
