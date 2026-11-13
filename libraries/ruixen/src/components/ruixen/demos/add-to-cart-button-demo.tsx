import { AddToCartButton } from "@/components/ruixen/add-to-cart-button";

export default function AddToCartButtonDemo() {
  return (
    <div className="flex min-h-[200px] w-full items-center justify-center">
      <AddToCartButton price={24.99} currency="$" />
    </div>
  );
}
