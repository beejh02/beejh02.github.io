# Third-party notices

## The Book of Qbject

Source: [Qbject/the-book-of-qbject](https://github.com/Qbject/the-book-of-qbject)

The paper geometry, Bézier bending, cover motion, and book assembly in
`src/study/Page.ts` and `src/study/scene.ts` are adapted from the project's
`src/page.ts`, `src/flipbook.ts`, and `src/util.ts`.

The adaptation uses locally generated materials, blank pages, a brighter desk,
and scene-owned rendering and resource cleanup. Page materials accept shared
Three.js textures directly; unused content links, videos, overlays, and debugging
tools are omitted. No original image or video assets are included. Those assets
are not covered by the upstream software license.

### MIT License

Copyright (c) 2025 Qbject

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
