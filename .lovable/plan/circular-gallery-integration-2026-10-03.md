# Circular gallery integration

## Goal
Replace the static curved portrait strip with the referenced React Bits circular gallery interaction, using the existing Women’s Collective portraits.

## Implementation
- Add the lightweight WebGL renderer used by the reference.
- Rebuild `CurvedGallery` as an infinite, draggable circular track with wheel and arrow-key navigation.
- Keep the existing component name and image API so the homepage and design-system gallery update together.
- Use the system’s local typography, spacing, radius, motion timing, and reduced-motion behavior.
- Keep semantic image alternatives available for accessibility while the canvas provides the visual effect.

## Verification
- Check drag, wheel, and keyboard navigation.
- Verify desktop and mobile framing, reduced motion, cleanup, and a clean build.

## Technical notes
The implementation will be client-initialized to remain safe during server rendering. Rendering logic and helpers will stay inside the design-system subtree so attached projects receive a complete component.
