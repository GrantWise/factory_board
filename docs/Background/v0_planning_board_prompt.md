# Factory Planning Board - V0 UI Requirements

## Overview
Create a digital kanban-style planning board for manufacturing operations that replicates the functionality of traditional magnetic planning boards used in factories.

## Core Functionality
Build an electronic planning board interface that displays manufacturing orders as cards that can be moved between columns representing different work centres/manufacturing steps.

## Data Structure
The application should be designed to work with manufacturing orders containing:
- **Order Number**: Unique identifier for each manufacturing order
- **Stock Code**: Product identifier
- **Description**: Product description
- **Quantity to Make**: Total quantity required
- **Manufacturing Steps**: Sequential steps required to complete the order
- **Work Centres**: Each step is assigned to a specific work centre
- **Progress Data**: Current quantity completed and percentage complete per step

## UI Layout Requirements

### Board Structure
- **Horizontal Layout**: Columns represent different work centres
- **Column Headers**: Clear work centre names/identifiers
- **Cards**: Manufacturing orders displayed as moveable cards within columns
- **Visual Flow**: Left-to-right progression showing manufacturing workflow

### Card Design
Each manufacturing order card should display:
- Order number (prominently displayed)
- Stock code
- Product description
- Total quantity to make
- Current manufacturing step
- Progress indicator (percentage complete)
- Quantity completed vs. total required
- Visual status indicators (not started, in progress, complete)

### Visual Design
- **Clean, Industrial Look**: Professional appearance suitable for factory floor use
- **High Contrast**: Easy to read from a distance
- **Color Coding**: Different colors for different statuses (pending, in progress, complete, overdue)
- **Responsive Design**: Works on tablets and large screens
- **Touch-Friendly**: Large enough touch targets for factory floor use

## Key Features to Include

### Card Movement
- Drag and drop functionality to move cards between work centre columns
- Visual feedback during drag operations
- Smooth animations for card transitions

### Progress Visualization
- Progress bars showing completion percentage
- Clear quantity indicators (e.g., "150/500 completed")
- Visual distinction between started and not-started orders

### Status Indicators
- Color-coded status system:
  - Grey/White: Not started
  - Blue: In progress
  - Green: Complete
  - Red: Overdue/Issues
- Status badges or icons on cards

### Work Centre Columns
- Clearly labeled columns for each work centre
- Ability to handle multiple cards per column
- Visual indication of work centre capacity/load

## Technical Considerations
- Design should accommodate real-time updates from scanning system
- Cards should be able to update automatically when progress is scanned
- Consider how cards will move automatically when steps are completed
- Plan for database integration (though not implemented in this initial version)

## Initial Scope
For this first version, create:
1. Static layout with sample data
2. Drag and drop functionality between columns
3. Professional card design with all required information
4. Responsive column layout
5. Basic color coding and status indicators

## Sample Data to Use
Create mock manufacturing orders with:
- 3-4 different work centres (e.g., "Cutting", "Assembly", "Quality Check", "Packaging")
- 8-10 sample orders in various stages of completion
- Different product types and quantities
- Realistic order numbers and stock codes

## Design Priorities
1. **Clarity**: Information must be easily readable
2. **Functionality**: Smooth drag-and-drop experience
3. **Professional Appearance**: Suitable for manufacturing environment
4. **Scalability**: Design should work with many orders and work centres

Please create a fully functional prototype with sample data that demonstrates the core planning board concept.