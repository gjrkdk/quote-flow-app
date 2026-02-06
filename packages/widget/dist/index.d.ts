import { JSX as JSX_2 } from 'react/jsx-runtime';

/**
 * Event payload when Draft Order is created.
 * Passed to onAddToCart callback.
 */
export declare interface AddToCartEvent {
    /** Shopify Draft Order GID */
    draftOrderId: string;
    /** Customer-facing checkout URL */
    checkoutUrl: string;
    /** Unit price from matrix */
    price: number;
    /** Total price (unit price * quantity) */
    total: number;
    /** Dimensions used for pricing */
    dimensions: {
        width: number;
        height: number;
        unit: string;
    };
    /** Quantity ordered */
    quantity: number;
}

/**
 * PriceMatrixWidget - Drop-in React component for dimension-based pricing.
 *
 * Renders inside Shadow DOM for CSS isolation.
 * Customer enters width/height, sees live price, adjusts quantity, and adds to cart.
 * Creates Shopify Draft Order and redirects to checkout.
 *
 * @example
 * ```tsx
 * <PriceMatrixWidget
 *   apiUrl="https://your-app.example.com"
 *   apiKey="pm_abc123"
 *   productId="gid://shopify/Product/123"
 *   theme={{ primaryColor: '#ff6b6b' }}
 *   onAddToCart={(event) => console.log('Added to cart:', event)}
 * />
 * ```
 */
export declare function PriceMatrixWidget(props: PriceMatrixWidgetProps): JSX_2.Element;

/**
 * Props for the PriceMatrixWidget component.
 *
 * Required: apiUrl, apiKey, productId
 * Optional: theme, onAddToCart
 */
export declare interface PriceMatrixWidgetProps {
    /** REST API base URL (e.g., "https://your-app.example.com") */
    apiUrl: string;
    /** API key for X-API-Key authentication */
    apiKey: string;
    /** Shopify product ID (numeric string or gid:// format) */
    productId: string;
    /** Optional theme customization via CSS custom properties */
    theme?: ThemeProps;
    /** Callback fired when Draft Order is successfully created */
    onAddToCart?: (event: AddToCartEvent) => void;
}

/**
 * Theme customization props. Each maps to a CSS custom property.
 * All optional — defaults are applied via CSS fallbacks.
 */
export declare interface ThemeProps {
    /** Primary button/accent color. CSS var: --pm-primary-color. Default: #5c6ac4 */
    primaryColor?: string;
    /** Main text color. CSS var: --pm-text-color. Default: #202223 */
    textColor?: string;
    /** Border color for inputs. CSS var: --pm-border-color. Default: #c9cccf */
    borderColor?: string;
    /** Border radius for inputs and buttons. CSS var: --pm-border-radius. Default: 8px */
    borderRadius?: string;
    /** Base font size. CSS var: --pm-font-size. Default: 14px */
    fontSize?: string;
    /** Error text color. CSS var: --pm-error-color. Default: #d72c0d */
    errorColor?: string;
}

export { }
