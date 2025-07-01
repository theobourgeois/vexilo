"use client";

import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "./ui/drawer";
import { AuthHeader } from "./auth-header";
import { PostFlagButton } from "./post-flag-button";
import Logo from "./Logo";

export function HamburgerMenu() {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="neutral" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-4 justify-start">
            <Logo showText />
            <AuthHeader />
            <PostFlagButton />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
} 