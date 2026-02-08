import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Whiteboard App",
  description:
    "Documentation for the infinite whiteboard app: architecture, guidelines, and project structure.",
  base: "/docs/",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Project structure", link: "/project-structure" },
      { text: "NASA guidelines", link: "/nasa-coding-guidelines" },
    ],
    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Project structure", link: "/project-structure" },
        ],
      },
      {
        text: "Standards",
        items: [
          { text: "NASA Coding Guidelines", link: "/nasa-coding-guidelines" },
        ],
      },
    ],
    socialLinks: [],
    footer: {
      message: "Whiteboard App documentation.",
      copyright: "Private / unlicensed unless otherwise specified.",
    },
  },
});
