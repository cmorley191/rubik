/*
 * Facilitates image imports in .tsx files, e.g.
 * import * as imgCat from 'images/cat.png';
 * ...
 * render() { return (
 *   <img src={imgCat} />
 * )}
 */

declare module '*.png' { const value: any; export = value; }
declare module '*.svg' { const value: any; export = value; }
declare module '*.jpg' { const value: any; export = value; }
declare module '*.jpeg' { const value: any; export = value; }
declare module '*.gif' { const value: any; export = value; }