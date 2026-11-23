"use client";

import { AvatarFallback, AvatarImage, Avatar as ShadcnAvatar } from "../ui/avatar";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { safeImage } from "../safe";

const AvatarSchema = z.object({
  src: z.string().optional(),
  alt: z.string().optional(),
  fallback: z.string(),
});

export const Avatar = defineComponent({
  name: "Avatar",
  props: AvatarSchema,
  description: "Circular avatar with image and fallback text.",
  component: ({ props }) => (
    <ShadcnAvatar>
      {safeImage(props.src) && <AvatarImage src={safeImage(props.src)} alt={props.alt ?? ""} />}
      <AvatarFallback>{props.fallback}</AvatarFallback>
    </ShadcnAvatar>
  ),
});
