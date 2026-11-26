/**
 * CastTalk icon set — pixel icons (pixelarticons, strict 24px grid) that match
 * the Geist Pixel Square type of the ember redesign.
 *
 * Exports keep the Phosphor names and props (`size`, `weight`, `color`,
 * `mirrored`) the app was written against, so screens switch icon sets by
 * changing only their import line. `weight` is accepted and ignored: pixel
 * icons have a single, solid style.
 */
import type { CSSProperties, SVGProps } from 'react';
import {
  Android,
  ArrowLeft as PxArrowLeft,
  ArrowUpBox,
  BadgeCaptions,
  Bell as PxBell,
  Calendar as PxCalendar,
  CalendarText,
  Card,
  Check as PxCheck,
  CheckboxOn,
  ChevronDown as ChevronDown_,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle as PxCircle,
  CircleInfo,
  ClipboardNote,
  Clock as PxClock,
  Close,
  Copy as PxCopy,
  Crown as PxCrown,
  Globe as PxGlobe,
  Grid2x22,
  Hand,
  Home,
  Hourglass as PxHourglass,
  InfoBox,
  Link as PxLink,
  Loader,
  Lock as PxLock,
  Logout,
  MapPin,
  Menu,
  Message,
  Mic as Mic_,
  MicOff,
  Monitor as PxMonitor,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Play as PxPlay,
  Plus as PxPlus,
  PlusBox,
  Robot,
  Search as Search_,
  Send,
  SettingsCog,
  Shield,
  Sliders as PxSliders,
  Sparkle as PxSparkle,
  Stop,
  Trash as PxTrash,
  Undo,
  User as User_,
  UserPlus as PxUserPlus,
  Users as PxUsers,
  Video,
  VolumeX,
  WarningDiamond,
  AiSettings2,
  ArrowUp as PxArrowUp,
  Attachment,
  Checkbox as PxCheckbox,
  FileText as PxFileText,
  Folder,
  Sparkles as PxSparkles,
  Square as PxSquare,
  StopSolid,
} from 'pixelarticons/react';

type PixelIcon = (props: SVGProps<SVGSVGElement>) => JSX.Element;

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & {
  size?: number | string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
  mirrored?: boolean;
};

const px = (Icon: PixelIcon, displayName: string) => {
  const Wrapped = ({ size = 24, weight: _weight, color, mirrored, style, ...rest }: IconProps) => {
    const merged: CSSProperties = {
      ...(color ? { color } : null),
      ...(mirrored ? { transform: 'scaleX(-1)' } : null),
      ...style,
    };
    return <Icon width={size} height={size} aria-hidden={rest['aria-label'] ? undefined : true} style={merged} {...rest} />;
  };
  Wrapped.displayName = displayName;
  return Wrapped;
};

// Pixel "video off": the camera body with a stepped pixel slash through it
const VideoOffPixel: PixelIcon = (props) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M20 17V7h2v10zm-2-2V9h2v6zM2 7h2v10H2zm14 0h2v3h-2zm0 5h2v3h-2zM6 5h10v2H6zm0 12h8v2H6z" />
    <path d="M2 2h2v2H2zm2 2h2v2H4zm2 2h2v2H6zm2 2h2v2H8zm2 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2z" />
  </svg>
);

// Navigation & chrome
export const ArrowLeft = px(PxArrowLeft, 'ArrowLeft');
export const ArrowSquareUp = px(ArrowUpBox, 'ArrowSquareUp');
export const CaretDown = px(ChevronDown_, 'CaretDown');
export const CaretLeft = px(ChevronLeft, 'CaretLeft');
export const CaretRight = px(ChevronRight, 'CaretRight');
export const CaretUp = px(ChevronUp, 'CaretUp');
export const DotsThree = px(MoreHorizontal, 'DotsThree');
export const DotsThreeVertical = px(MoreVertical, 'DotsThreeVertical');
export const House = px(Home, 'House');
export const List = px(Menu, 'List');
export const MagnifyingGlass = px(Search_, 'MagnifyingGlass');
export const SignOut = px(Logout, 'SignOut');
export const X = px(Close, 'X');

// Status & feedback
export const Bell = px(PxBell, 'Bell');
export const Check = px(PxCheck, 'Check');
export const CheckCircle = px(CheckboxOn, 'CheckCircle');
export const Circle = px(PxCircle, 'Circle');
export const CircleNotch = px(Loader, 'CircleNotch');
export const Info = px(InfoBox, 'Info');
export const ShieldCheck = px(Shield, 'ShieldCheck');
export const ShieldWarning = px(Shield, 'ShieldWarning');
export const SpinnerGap = px(Loader, 'SpinnerGap');
export const WarningCircle = px(WarningDiamond, 'WarningCircle');
export const InfoCircle = px(CircleInfo, 'InfoCircle');

// Time & scheduling
export const Calendar = px(PxCalendar, 'Calendar');
export const CalendarCheck = px(CalendarText, 'CalendarCheck');
export const Clock = px(PxClock, 'Clock');
export const ClockCounterClockwise = px(Undo, 'ClockCounterClockwise');
export const Hourglass = px(PxHourglass, 'Hourglass');
export const Timer = px(PxClock, 'Timer');

// Call controls
export const ClosedCaptioning = px(BadgeCaptions, 'ClosedCaptioning');
export const HandPalm = px(Hand, 'HandPalm');
export const Microphone = px(Mic_, 'Microphone');
export const MicrophoneSlash = px(MicOff, 'MicrophoneSlash');
export const Monitor = px(PxMonitor, 'Monitor');
export const SpeakerSlash = px(VolumeX, 'SpeakerSlash');
export const VideoCamera = px(Video, 'VideoCamera');
export const VideoCameraSlash = px(VideoOffPixel, 'VideoCameraSlash');
export const FilmReel = px(Video, 'FilmReel');
export const Play = px(PxPlay, 'Play');
export const StopCircle = px(Stop, 'StopCircle');
export const PushPin = px(MapPin, 'PushPin');
export const GridFour = px(Grid2x22, 'GridFour');
export const SquaresFour = px(Grid2x22, 'SquaresFour');

// People & roles
export const Crown = px(PxCrown, 'Crown');
export const IdentificationBadge = px(Card, 'IdentificationBadge');
export const UserCircle = px(User_, 'UserCircle');
export const UserGear = px(User_, 'UserGear');
export const UserPlus = px(PxUserPlus, 'UserPlus');
export const Users = px(PxUsers, 'Users');

// Actions & content
export const ChatCircle = px(Message, 'ChatCircle');
export const ClipboardText = px(ClipboardNote, 'ClipboardText');
export const Copy = px(PxCopy, 'Copy');
export const Gear = px(SettingsCog, 'Gear');
export const Globe = px(PxGlobe, 'Globe');
export const Link = px(PxLink, 'Link');
export const Lock = px(PxLock, 'Lock');
export const PaperPlaneRight = px(Send, 'PaperPlaneRight');
export const PencilSimple = px(Pencil, 'PencilSimple');
export const Plus = px(PxPlus, 'Plus');
export const PlusCircle = px(PlusBox, 'PlusCircle');
export const PlusSquare = px(PlusBox, 'PlusSquare');
export const Sliders = px(PxSliders, 'Sliders');
export const Trash = px(PxTrash, 'Trash');

// Brand / AI
export const AndroidLogo = px(Android, 'AndroidLogo');
export const Brain = px(Robot, 'Brain');
export const Sparkle = px(PxSparkle, 'Sparkle');

// Lucide names used by CastAI, the prompt box and the agent plan (same props:
// className sizes win over the default width/height)
export const Sparkles = px(PxSparkles, 'Sparkles');
export const User = px(User_, 'User');
export const FileText = px(PxFileText, 'FileText');
export const CheckSquare = px(PxCheckbox, 'CheckSquare');
export const ChevronDown = px(ChevronDown_, 'ChevronDown');
export const Pin = px(MapPin, 'Pin');
export const Trash2 = px(PxTrash, 'Trash2');
export const Search = px(Search_, 'Search');
export const MessageSquare = px(Message, 'MessageSquare');
export const Loader2 = px(Loader, 'Loader2');
export const ArrowUp = px(PxArrowUp, 'ArrowUp');
export const Paperclip = px(Attachment, 'Paperclip');
export const Square = px(PxSquare, 'Square');
export const StopSolidIcon = px(StopSolid, 'StopSolidIcon');
export const Mic = px(Mic_, 'Mic');
export const BrainCog = px(AiSettings2, 'BrainCog');
export const FolderCog = px(Folder, 'FolderCog');
export const History = px(Undo, 'History');
export const CheckCircle2 = px(CheckboxOn, 'CheckCircle2');
export const AlertCircle = px(WarningDiamond, 'AlertCircle');
export const CircleDotDashed = px(Loader, 'CircleDotDashed');
export const XCircle = px(Close, 'XCircle');
