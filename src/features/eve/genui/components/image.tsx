"use client";

import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { safeImage } from "../safe";

const ImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
});

export const Image = defineComponent({
  name: "Image",
  props: ImageSchema,
  description: "Displays an image with optional alt text.",
  component: ({ props }) => {
    const src = safeImage(props.src);
    if (!src) return props.alt ? <p className="text-sm text-muted-foreground">{props.alt}</p> : null;
    return (
      <div className="overflow-hidden rounded-lg">
        <img src={src} alt={props.alt ?? ""} className="w-full h-auto object-cover rounded-lg" />
      </div>
    );
  },
});

const ImageBlockSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const ImageBlock = defineComponent({
  name: "ImageBlock",
  props: ImageBlockSchema,
  description: "Image with optional caption.",
  component: ({ props }) => {
    const src = safeImage(props.src);
    return (
      <figure className="space-y-2">
        {src && (
          <div className="overflow-hidden rounded-lg">
            <img src={src} alt={props.alt ?? ""} className="w-full h-auto object-cover rounded-lg" />
          </div>
        )}
        {(props.caption || (!src && props.alt)) && (
          <figcaption className="text-sm text-muted-foreground text-center">
            {props.caption ?? props.alt}
          </figcaption>
        )}
      </figure>
    );
  },
});
