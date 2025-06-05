# Manufacturing Planning Board - User Interface Design Document

## Layout Structure

### Primary Layout (Desktop/Tablet Optimized)
- **Fixed Header Bar**: Company branding, department selector (future), user profile, and global controls
- **Collapsible Sidebar Navigation**: 
  - Department/Board switcher (collapsed in MVP, expandable for future)
  - Main navigation (Dashboard, Planning Board, Orders, Work Centres, Analytics, Settings)
  - User presence indicators and online status
- **Main Content Area**: 
  - Analytics cards row (4-6 key metrics)
  - Full-width kanban planning board with horizontal scrolling for many work centres
  - Contextual action panels (slide out from right when needed)

### Planning Board Grid System
- **Responsive columns**: 2-3 columns on tablet, 4-6 on desktop, horizontal scroll for overflow
- **Fixed column widths**: 320px minimum for comfortable card reading
- **Sticky headers**: Work centre headers remain visible during vertical scrolling
- **Smart spacing**: 16px gaps between columns, 12px between cards

## Core Components

### Manufacturing Order Cards (Information-Rich Design)
```
┌─────────────────────────────────┐
│ MO-2024-001              [🔥 H] │ ← Order# + Priority badge
│ BRACKET-A01 • Widget Bracket    │ ← Stock code + Description  
│ ━━━━━━━━━━━━━━━━━━━━━━━━ 75%    │ ← Progress bar with %
│ 150/200 • TURNING • Due: 6/15  │ ← Qty + Current step + Due date
│ ────────────────────────────── │
│ 💡 CUT-03 typical (87%)        │ ← Future: AI suggestion
└─────────────────────────────────┘
```

**Card States:**
- **Default**: Clean white background, subtle shadow
- **Dragging**: Elevated shadow, slight rotation, 90% opacity
- **Locked**: Red border, lock icon, "Locked by John" overlay
- **Overdue**: Red accent border, urgent styling
- **Complete**: Green accent, checkmark icon

### Work Centre Columns
```
┌─────────────────────────────────┐
│ LATHE-01        (5 jobs) ⚙️ ⋮   │ ← Name + count + settings menu
│ ████████████░░░░ 75%           │ ← Utilization bar
├─────────────────────────────────┤
│                                 │
│    [Drop manufacturing          │ ← Drop zone with guidance
│     orders here]                │
│                                 │
│    [Order Card]                 │ ← Stacked order cards
│    [Order Card]                 │
│    [Order Card]                 │
└─────────────────────────────────┘
```

### Real-Time Collaboration Elements
- **User Avatars**: Small circular avatars showing who's online
- **Live Cursors**: Show other users' mouse positions during active sessions
- **Lock Indicators**: Clear visual feedback when orders are being moved
- **Activity Feed**: Sidebar panel showing recent moves and changes

### Analytics Cards (Dashboard Header)
- **4-6 key metrics** in card layout above planning board
- **Large numbers** with trend indicators (↗️ ↘️)
- **Color-coded status**: Green for good, yellow for attention, red for problems
- **Click to expand** for detailed charts and timeframes

## Interaction Patterns

### Primary Workflow: Drag & Drop Order Movement
1. **Hover State**: Card slightly elevates, shows grab cursor
2. **Drag Start**: Card lifts with rotation, other valid drop zones highlight green
3. **Drag Over**: Drop zone shows preview placement, invalid zones show red
4. **Drop Success**: Smooth animation to final position, brief success flash
5. **Conflict Detection**: Modal dialog for locked orders with alternative suggestions

### Secondary Interactions
- **Card Click**: Expand details panel from right side
- **Column Header Click**: Work centre configuration and analytics
- **Double-tap Card**: Quick status change (tablet optimized)
- **Right-click/Long-press**: Context menu with order actions
- **Keyboard Navigation**: Full keyboard support for accessibility

### Touch Optimization (Tablet)
- **Large touch targets**: Minimum 44px for all interactive elements
- **Touch feedback**: Subtle haptic response and visual feedback
- **Gesture support**: Pinch-to-zoom for detailed view, swipe for column navigation
- **Edge scrolling**: Automatic scrolling when dragging near screen edges

## Visual Design Elements & Color Scheme

### Brand Color Implementation
- **Primary Blue (#00609C)**: Navigation, active states, progress bars
- **Primary Grey (#B3B2B1)**: Text, borders, inactive elements  
- **Secondary Blue (#C8DAF3)**: Hover states, selected items, info backgrounds
- **Secondary Grey (#DFE4E6)**: Backgrounds, dividers, subtle accents

### Status Color System
- **Not Started**: Light grey (#F5F5F5)
- **In Progress**: Primary blue (#00609C) 
- **Complete**: Success green (#22C55E)
- **Overdue**: Danger red (#EF4444)
- **Waiting**: Warning amber (#F59E0B)
- **Priority High**: Urgent red accent
- **Priority Normal**: No special color

### Visual Hierarchy
- **Large headers**: 24px for work centre names
- **Medium text**: 16px for order numbers and key info
- **Small text**: 14px for secondary information
- **Micro text**: 12px for metadata and timestamps

## Mobile, Web App, Desktop Considerations

### Desktop (Primary Target)
- **Wide viewport utilization**: 6+ work centre columns visible
- **Mouse interactions**: Precise drag-and-drop, hover states, right-click menus
- **Keyboard shortcuts**: Hotkeys for common actions, tab navigation
- **Multi-monitor support**: Planning board on main screen, analytics on secondary

### Tablet (Secondary Target)  
- **Touch-first design**: Large touch targets, gesture navigation
- **Portrait/landscape adaptation**: Column count adjusts to orientation
- **On-screen keyboard accommodation**: Interface shifts up when keyboard appears
- **Performance optimization**: Smooth 60fps animations even with many cards

### Future Multi-Department Architecture
- **Department switcher**: Dropdown in header (hidden in MVP)
- **Cross-department visibility**: "All Departments" view for supervisors
- **Consistent branding**: Each department can have color variations
- **Unified analytics**: Roll-up metrics across departments

## Typography

### Font Family
- **Primary**: Inter (system font fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI')
- **Monospace**: 'JetBrains Mono' for order numbers and codes
- **Fallbacks**: Optimized for Windows, macOS, and Linux

### Type Scale
- **H1 (32px)**: Page titles, department names
- **H2 (24px)**: Work centre headers, section titles  
- **H3 (20px)**: Card headers, important labels
- **Body (16px)**: Primary content, order descriptions
- **Small (14px)**: Secondary information, metadata
- **Micro (12px)**: Timestamps, technical details

### Font Weights
- **Bold (700)**: Headers, important data points
- **Semibold (600)**: Order numbers, priority items
- **Regular (400)**: Body text, descriptions
- **Medium (500)**: Labels, secondary headers

## Accessibility

### Visual Accessibility
- **High contrast ratios**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Color-blind friendly**: Status information never relies solely on color
- **Focus indicators**: Clear 2px blue outline on all interactive elements
- **Text scaling**: Support up to 200% zoom without horizontal scrolling

### Motor Accessibility  
- **Large touch targets**: Minimum 44px for touch interfaces
- **Keyboard navigation**: Full functionality without mouse
- **Drag alternatives**: Keyboard and context menu options for all drag operations
- **Timing flexibility**: No time-based interactions that can't be extended

### Cognitive Accessibility
- **Clear visual hierarchy**: Consistent layout patterns and information organization
- **Error prevention**: Confirmation dialogs for destructive actions
- **Undo functionality**: Easy reversal of accidental moves
- **Progressive disclosure**: Complex features hidden until needed

### Screen Reader Support
- **Semantic HTML**: Proper heading structure and landmark regions
- **ARIA labels**: Descriptive labels for all interactive elements
- **Live regions**: Announce real-time updates and state changes
- **Alternative text**: Descriptive text for all visual indicators

### Industrial Environment Considerations
- **Bright lighting tolerance**: High contrast design works under harsh lighting
- **Viewing distance**: Readable from 2-3 feet away
- **Noise environments**: Visual feedback for all audio cues
- **Quick scanning**: Information hierarchy supports rapid visual scanning

## Implementation Notes

### Progressive Enhancement Strategy
- **Phase 1 (MVP)**: Core drag-and-drop functionality with rich information display
- **Phase 2**: Gentle AI suggestions appear in dedicated card sections
- **Phase 3**: Predictive routing with confidence indicators
- **Phase 4**: Full intelligent workflow optimization

### Performance Considerations
- **Virtual scrolling**: Handle hundreds of orders without performance degradation
- **Optimistic updates**: Immediate UI feedback with server sync
- **Efficient re-renders**: Minimize React re-renders during drag operations
- **WebSocket optimization**: Throttled updates to prevent UI flooding

### Data Architecture Support
- **Flexible card content**: Design accommodates varying data richness
- **Real-time state management**: Visual indicators for all collaborative states
- **Future-proof layout**: Space reserved for AI suggestions and analytics
- **Multi-department scalability**: Design patterns that scale across departments

This design foundation supports your current feature-rich implementation while preparing for the intelligent routing suggestions and multi-department expansion outlined in your roadmap.