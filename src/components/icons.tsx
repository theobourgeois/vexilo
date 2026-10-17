// The app's single icon set: Phosphor, bold weight by default.
// Names mirror what the codebase already used so imports stay readable.
// Uses the SSR build so icons render in both server and client components.
import { forwardRef } from 'react';
import type { Icon as PhosphorIcon, IconProps } from '@phosphor-icons/react';
import * as Ph from '@phosphor-icons/react/dist/ssr';

export type Icon = PhosphorIcon;
export type { IconProps };

function bold(Base: PhosphorIcon, name: string): PhosphorIcon {
  const Wrapped = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <Base ref={ref} weight='bold' {...props} />
  ));
  Wrapped.displayName = name;
  return Wrapped as PhosphorIcon;
}

export const AlertTriangle = bold(Ph.Warning, 'AlertTriangle');
export const TriangleAlert = AlertTriangle;
export const ArrowLeft = bold(Ph.ArrowLeft, 'ArrowLeft');
export const ArrowRight = bold(Ph.ArrowRight, 'ArrowRight');
export const ArrowDown = bold(Ph.ArrowDown, 'ArrowDown');
export const ArrowUpRight = bold(Ph.ArrowUpRight, 'ArrowUpRight');
export const Award = bold(Ph.Medal, 'Award');
export const Medal = Award;
export const BookOpen = bold(Ph.BookOpen, 'BookOpen');
export const Calendar = bold(Ph.CalendarBlank, 'Calendar');
export const Check = bold(Ph.Check, 'Check');
export const CheckIcon = Check;
export const CheckCircle = bold(Ph.CheckCircle, 'CheckCircle');
export const ChevronDown = bold(Ph.CaretDown, 'ChevronDown');
export const ChevronDownIcon = ChevronDown;
export const ChevronLeft = bold(Ph.CaretLeft, 'ChevronLeft');
export const ChevronRight = bold(Ph.CaretRight, 'ChevronRight');
export const ChevronUp = bold(Ph.CaretUp, 'ChevronUp');
export const ChevronUpIcon = ChevronUp;
export const Circle = bold(Ph.Circle, 'Circle');
export const Clock = bold(Ph.Clock, 'Clock');
export const Coffee = bold(Ph.Coffee, 'Coffee');
export const Copy = bold(Ph.Copy, 'Copy');
export const CornerDownRight = bold(Ph.ArrowElbowDownRight, 'CornerDownRight');
export const Database = bold(Ph.Database, 'Database');
export const Download = bold(Ph.DownloadSimple, 'Download');
export const Edit = bold(Ph.PencilSimple, 'Edit');
export const Pencil = Edit;
export const ExternalLink = bold(Ph.ArrowSquareOut, 'ExternalLink');
export const Eye = bold(Ph.Eye, 'Eye');
export const FileText = bold(Ph.FileText, 'FileText');
export const Fire = bold(Ph.Fire, 'Fire');
export const Flag = bold(Ph.Flag, 'Flag');
export const ImageBroken = bold(Ph.ImageBroken, 'ImageBroken');
export const FlagBanner = bold(Ph.FlagBanner, 'FlagBanner');
export const FolderOpen = bold(Ph.FolderOpen, 'FolderOpen');
export const Gamepad2 = bold(Ph.GameController, 'Gamepad2');
export const Globe = bold(Ph.Globe, 'Globe');
export const GoogleLogo = bold(Ph.GoogleLogo, 'GoogleLogo');
export const Hash = bold(Ph.Hash, 'Hash');
export const Heart = bold(Ph.Heart, 'Heart');
export const History = bold(Ph.ClockCounterClockwise, 'History');
export const Home = bold(Ph.House, 'Home');
export const Hourglass = bold(Ph.HourglassMedium, 'Hourglass');
export const Link = bold(Ph.LinkSimple, 'Link');
export const Link2 = Link;
export const Loader2 = bold(Ph.CircleNotch, 'Loader2');
export const LogOut = bold(Ph.SignOut, 'LogOut');
export const Menu = bold(Ph.List, 'Menu');
export const Moon = bold(Ph.Moon, 'Moon');
export const MoreHorizontal = bold(Ph.DotsThree, 'MoreHorizontal');
export const Palette = bold(Ph.Palette, 'Palette');
export const Plus = bold(Ph.Plus, 'Plus');
export const RefreshCw = bold(Ph.ArrowClockwise, 'RefreshCw');
export const RotateCw = RefreshCw;
export const Save = bold(Ph.FloppyDisk, 'Save');
export const Search = bold(Ph.MagnifyingGlass, 'Search');
export const Send = bold(Ph.PaperPlaneTilt, 'Send');
export const Settings = bold(Ph.GearSix, 'Settings');
export const Share = bold(Ph.ShareNetwork, 'Share');
export const Shield = bold(Ph.Shield, 'Shield');
export const ShieldCheck = bold(Ph.ShieldCheck, 'ShieldCheck');
export const Shuffle = bold(Ph.Shuffle, 'Shuffle');
export const SlidersHorizontal = bold(Ph.SlidersHorizontal, 'SlidersHorizontal');
export const Sparkles = bold(Ph.Sparkle, 'Sparkles');
export const SquaresFour = bold(Ph.SquaresFour, 'SquaresFour');
export const Star = bold(Ph.Star, 'Star');
export const Sun = bold(Ph.Sun, 'Sun');
export const Target = bold(Ph.Target, 'Target');
export const Text = bold(Ph.TextT, 'Text');
export const Trash2 = bold(Ph.Trash, 'Trash2');
export const Trophy = bold(Ph.Trophy, 'Trophy');
export const Upload = bold(Ph.UploadSimple, 'Upload');
export const User = bold(Ph.User, 'User');
export const UserCircle = bold(Ph.UserCircle, 'UserCircle');
export const Users = bold(Ph.Users, 'Users');
export const WandSparkles = bold(Ph.MagicWand, 'WandSparkles');
export const X = bold(Ph.X, 'X');
export const XCircle = bold(Ph.XCircle, 'XCircle');
export const Zap = bold(Ph.Lightning, 'Zap');

// Admin console
export const CheckCheck = bold(Ph.Checks, 'CheckCheck');
export const CircleCheck = CheckCircle;
export const Equal = bold(Ph.Equals, 'Equal');
export const FileX = bold(Ph.FileX, 'FileX');
export const FlagTriangleRight = bold(Ph.FlagPennant, 'FlagTriangleRight');
export const Inbox = bold(Ph.Tray, 'Inbox');
export const LayoutGrid = SquaresFour;
export const Minus = bold(Ph.Minus, 'Minus');
export const PartyPopper = bold(Ph.Confetti, 'PartyPopper');
export const ScanEye = bold(Ph.Scan, 'ScanEye');
export const SkipForward = bold(Ph.SkipForward, 'SkipForward');
export const Tag = bold(Ph.Tag, 'Tag');
export const Undo2 = bold(Ph.ArrowUUpLeft, 'Undo2');
export const Wrench = bold(Ph.Wrench, 'Wrench');
