"use client";

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type SVGProps,
} from "react";

export type SVGIconProps = SVGProps<SVGSVGElement> & { size?: number | string; title?: string };
export type SVGIconComponent = ForwardRefExoticComponent<
  SVGIconProps & RefAttributes<SVGSVGElement>
>;
/** Compatibility type for component records that previously accepted LucideIcon. */
export type LucideIcon = SVGIconComponent;

function createIcon(id: string, displayName: string): SVGIconComponent {
  const Icon = forwardRef<SVGSVGElement, SVGIconProps>(function UIIcon(
    { size = 24, width, height, children, title, ...svgProps },
    ref,
  ) {
    const hasAccessibleName = Boolean(
      svgProps["aria-label"] || svgProps["aria-labelledby"] || title,
    );

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={width ?? size}
        height={height ?? size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        role={hasAccessibleName ? "img" : undefined}
        aria-hidden={hasAccessibleName ? undefined : true}
        {...svgProps}
      >
        <use href={`/icons/ui/sprite.svg#icon-${id}`} />
        {title ? <title>{title}</title> : null}
        {children}
      </svg>
    );
  });

  Icon.displayName = displayName;
  return Icon;
}

export const AlertTriangle = createIcon("alert-triangle", "AlertTriangle");
export const Archive = createIcon("archive", "Archive");
export const ArrowDownRight = createIcon("arrow-down-right", "ArrowDownRight");
export const ArrowLeft = createIcon("arrow-left", "ArrowLeft");
export const ArrowRight = createIcon("arrow-right", "ArrowRight");
export const ArrowUpRight = createIcon("arrow-up-right", "ArrowUpRight");
export const BarChart3 = createIcon("bar-chart", "BarChart3");
export const Bell = createIcon("bell", "Bell");
export const Briefcase = createIcon("briefcase", "Briefcase");
export const CalendarClock = createIcon("calendar-clock", "CalendarClock");
export const CalendarDays = createIcon("calendar-days", "CalendarDays");
export const CalendarRange = createIcon("calendar-range", "CalendarRange");
export const Check = createIcon("check", "Check");
export const CheckCircle2 = createIcon("check-circle", "CheckCircle2");
export const CheckSquare = createIcon("check-square", "CheckSquare");
export const ChevronDown = createIcon("chevron-down", "ChevronDown");
export const ChevronLeft = createIcon("chevron-left", "ChevronLeft");
export const ChevronRight = createIcon("chevron-right", "ChevronRight");
export const ChevronUp = createIcon("chevron-up", "ChevronUp");
export const ChevronsLeft = createIcon("chevrons-left", "ChevronsLeft");
export const Circle = createIcon("circle", "Circle");
export const CircleDollarSign = createIcon("circle-dollar", "CircleDollarSign");
export const ClipboardCheck = createIcon("clipboard-check", "ClipboardCheck");
export const Clock3 = createIcon("clock", "Clock3");
export const Command = createIcon("command", "Command");
export const Compass = createIcon("compass", "Compass");
export const Download = createIcon("download", "Download");
export const Dumbbell = createIcon("dumbbell", "Dumbbell");
export const ExternalLink = createIcon("external-link", "ExternalLink");
export const Flag = createIcon("flag", "Flag");
export const Flame = createIcon("flame", "Flame");
export const FolderKanban = createIcon("folder-kanban", "FolderKanban");
export const Gauge = createIcon("gauge", "Gauge");
export const Goal = createIcon("goal", "Goal");
export const GraduationCap = createIcon("graduation-cap", "GraduationCap");
export const HeartPulse = createIcon("heart-pulse", "HeartPulse");
export const Home = createIcon("home", "Home");
export const House = createIcon("house", "House");
export const ImageIcon = createIcon("image", "ImageIcon");
export const ImageOff = createIcon("image-off", "ImageOff");
export const Inbox = createIcon("inbox", "Inbox");
export const InfoIcon = createIcon("info", "InfoIcon");
export const Languages = createIcon("languages", "Languages");
export const Laptop = createIcon("laptop", "Laptop");
export const Layers3 = createIcon("layers", "Layers3");
export const LayoutDashboard = createIcon("dashboard", "LayoutDashboard");
export const Lightbulb = createIcon("lightbulb", "Lightbulb");
export const ListTodo = createIcon("list-todo", "ListTodo");
export const Loader2 = createIcon("loader", "Loader2");
export const Lock = createIcon("lock", "Lock");
export const LogOut = createIcon("logout", "LogOut");
export const Menu = createIcon("menu", "Menu");
export const MessageCircle = createIcon("message-circle", "MessageCircle");
export const MoreHorizontal = createIcon("more-horizontal", "MoreHorizontal");
export const NotebookPen = createIcon("notebook-pen", "NotebookPen");
export const OctagonX = createIcon("octagon-x", "OctagonX");
export const Pencil = createIcon("pencil", "Pencil");
export const PiggyBank = createIcon("piggy-bank", "PiggyBank");
export const Plus = createIcon("plus", "Plus");
export const ReceiptText = createIcon("receipt", "ReceiptText");
export const RefreshCw = createIcon("refresh", "RefreshCw");
export const Repeat = createIcon("repeat", "Repeat");
export const RotateCcw = createIcon("rotate-ccw", "RotateCcw");
export const Search = createIcon("search", "Search");
export const Settings = createIcon("settings", "Settings");
export const ShoppingBag = createIcon("shopping-bag", "ShoppingBag");
export const SlidersHorizontal = createIcon("sliders", "SlidersHorizontal");
export const Sparkles = createIcon("sparkles", "Sparkles");
export const SquareCheck = CheckSquare;
export const StickyNote = createIcon("sticky-note", "StickyNote");
export const Store = createIcon("store", "Store");
export const Target = createIcon("target", "Target");
export const Trash2 = createIcon("trash", "Trash2");
export const TrendingUp = createIcon("trending-up", "TrendingUp");
export const Undo2 = createIcon("undo", "Undo2");
export const Unplug = createIcon("unplug", "Unplug");
export const WalletCards = createIcon("wallet-cards", "WalletCards");
export const WandSparkles = createIcon("wand", "WandSparkles");
export const WifiOff = createIcon("wifi-off", "WifiOff");
export const X = createIcon("x", "X");

export const CheckIcon = Check;
export const CircleCheckIcon = CheckCircle2;
export const CircleIcon = Circle;
export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
export const ChevronUpIcon = ChevronUp;
export const InboxIcon = Inbox;
export const Loader2Icon = Loader2;
export const MinusIcon = createIcon("minus", "MinusIcon");
export const OctagonXIcon = OctagonX;
export const TriangleAlertIcon = AlertTriangle;
export const XIcon = X;
