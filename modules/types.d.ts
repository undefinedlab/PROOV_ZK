
// Declare react-svg-to-image module
declare module 'react-svg-to-image' {
  interface SvgToImageOptions {
    scale?: number;
    format?: string;
    quality?: number;
    download?: boolean;
    ignore?: string;
    background?: string;
  }

  export default function d3SvgToImage(
    selector: string, 
    name: string, 
    options?: SvgToImageOptions
  ): Promise<string>;
} 