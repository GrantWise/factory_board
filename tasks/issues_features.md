
## Navigation
- The breadcrumb at th etop doesn't allow you to navigate up a level,
- There is a View Planning Board button at the top right of the screen, this is a dupliction of the menu item on the left, is thi sduplicatin good practice in terms of UI/UX?
- I feel that the UI/UX has not been properly considered for the left hand bar menu, API Keys and User Management are not items that are used every day, mostly once setup they are seldom used, but they are always visible should they not be moved to a sub-menu under settings?  In fact in settings we have 3 tabs, I like how they work but it seems like the ux is not consistent and the visual hierarchy is not consistent. 

## Dashboard
- the recent Activity panel all items listed show moved to Unkown, there seems to be an issue.

## Planning Board
- The Visual Grouping Legend at teh top of the page takes up a lot of space, I am no tsure it is neeeded, the colours should be self explanatory, or we can put it in a pop out panel on the right of the screen
- The board currently shows 6 columns, is it possible to make each column scrollable like in the TV Display? Or will this complicate the drag and drop? I don't want to break that at all.
- I woul dlike a way to collapse the cards so that only the important information is shown like on the TV Display. Ideally we would want th eoption to either open or collapse 1 card at a time or all the cards. We should limit the maximum width of the cards so that when the board is used on higher resolution displays more columns can be shown.
- The drop zone when reodering cards is very small I woul dlike it bigger if possible.
- The create Order button open a popup, thi sis very good but there are some issues, it does no tallow me to enter all the possible fields that can be captured for an order, e.g. all the attributes, perhaps it coul dhave a header section showing the Order number, Stock Code, Description, then have a tab that captures the qty, Priority, Work Centre and due date as it currently does, but then we could have additional 1 or more tabs, whatever makes intuitive sense, to capture all the other available fields like the order attributes, Perhaps the priority should also be captured in the header section. This needs considerable ui design thought.
- TV Display works really well, but perhaps in settings we can give the user the ability to configure the number of columns to display and the fields to display on the card, the default shoul dbe 6 columns like the planning board
- TV Display, can we provide the user the ability to choose a colour pallet in the settings?
- Add work centre button gives the user a message to use the left hand menu, then we should no thave this button.


## Work Centres
- When I try to edit a workcentre if I update the Machines, it is not saved to the database
- when i try to make the work centre inactive, I get a message that it has been updated, but the status does not change.
- whenI try to add a workcentre I get the folowing error:  npm run start:frontend exited with code 143
[1] 2025-06-11T17:52:56.947Z [INFO] SecurityService: Security audit event: {
[1]   event_type: 'security_policy_applied',
[1]   user_id: null,
[1]   ip_address: '::1',
[1]   user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
[1]   endpoint: 'GET /api/auth/me',
[1]   security_context: {
[1]     policy_applied: 'auth',
[1]     authentication_method: undefined,
[1]     api_key_system_id: undefined,
[1]     violations: []
[1]   }
[1] }

- there is a green power icon, I am not sure whatit does when I press it? I suspect it is for future
- WhenI delete a work centre I get teh message that says it has been deleted but the screen does not show that it has been deleted, but if I refresh the screen it is gone.
- when I delete a work centre, it is not clear what happens to the jobs on the work centre, I don't think we shoul dallow a workcentre to be deleted if there are jobs assigned to it. The warning needs to be clear and intuitive why the workcentre cant be deleted.

## Orders Management
- The orders Management grid is well laid out and the filtersand search works well, however I think we need a filter, sort option available for each column.
- I should be able to selected an order and edit it
- I should be able to select multipl eorders and update/edit specific fields, it seems to me that t woul dmake sense to be able to change Priority, Status, Due Date, and the attributes of multiple orders at once
- I would like to see a button that allows the user to retrieve new orders from the erp via an api call, we would need to think about the logic and setup carefully but it woul dbe a great feature rather than using the csv import and export. 
- Similarly I would like to see a way to setup the board so that it automatically updated the orders on the erp, perhaps a configurable timer defaulting to every 5 minutes.

## Analytics
This screen is misleading it should be a sub-item to the api management, the users of the planning board are not interested in the api analytics, they want to see the analystics of the jobs and work centres that they are managing.
- when I go to this screen I see no data I only get teh following errors:
Error: [API] Request failed: "{\n  \"error\": \"API key not found\",\n  \"code\": \"API_KEY_NOT_FOUND\",\n  \"status\": 404,\n  \"details\": {\n    \"error\": \"API key not found\",\n    \"code\": \"API_KEY_NOT_FOUND\"\n  }\n}"
    at createConsoleError (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/errors/console-error.js:27:71)
    at handleConsoleError (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/errors/use-error-handler.js:47:54)
    at console.error (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/globals/intercept-console-error.js:47:57)
    at ApiClient.request (webpack-internal:///(app-pages-browser)/./src/lib/api.ts:73:21)
    at async Object.getUsage (webpack-internal:///(app-pages-browser)/./src/lib/api-services.ts:251:26)
    at async useApiData.useCallback[fetchData] (webpack-internal:///(app-pages-browser)/./src/hooks/use-api-data.tsx:22:32)
	


	