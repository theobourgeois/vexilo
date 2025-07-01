import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export function PostFlagButton() {
    return (
        <Link href="/post-flag" className="">
            <Button className="">
                <Plus className="w-4 h-4" />
                Post Flag
            </Button>
        </Link>
    );
}
