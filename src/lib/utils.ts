import { createCn } from "cn/config"

/*
 * Class merging that knows the deck type scale and tone utilities, so
 * `text-micro text-ink` keeps both (size + color) instead of dropping one.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display-xl", "display-l", "display-m", "display-s", "title", "body", "micro", "mono"] },
      ],
      "text-color": [{ text: ["quiet", "faint"] }],
    },
  },
})
