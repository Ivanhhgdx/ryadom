import dynamic from "next/dynamic";

const Marketplace = dynamic(() => import("./marketplace"), { ssr: false });

export const dynamic = "force-static";

export default function Home() {
  return <Marketplace />;
}
