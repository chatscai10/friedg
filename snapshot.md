# Project Snapshot

## Directory Structure

```
├── .firebaserc
├── .gitignore
├── api-specs
│  ├── attendance.yaml
│  ├── auth.yaml
│  ├── employees.yaml
│  ├── inventory.yaml
│  ├── leave.yaml
│  ├── main.yaml
│  ├── menu.yaml
│  ├── openapi.yaml
│  ├── orders.yaml
│  ├── payments.yaml
│  ├── payroll.yaml
│  ├── pickup.yaml
│  ├── pos.yaml
│  ├── roles.yaml
│  ├── scheduling.yaml
│  ├── stores.yaml
│  └── users.yaml
├── cloudbuild.yaml
├── config.json
├── create-admin-user.js
├── docs
│  ├── auth_flow_v1.md
│  └── data_dictionary_v1.md
├── firebase-export-1746210189572DASsYd
│  └── firestore_export
│     └── all_namespaces
│        └── all_kinds
├── firebase-export-1746211287188S4pPQ3
│  ├── auth_export
│  │  ├── accounts.json
│  │  └── config.json
│  ├── firebase-export-metadata.json
│  └── firestore_export
│     ├── all_namespaces
│     │  └── all_kinds
│     └── firestore_export.overall_export_metadata
├── firebase-export-1746211654071QtVfqL
│  ├── auth_export
│  │  ├── accounts.json
│  │  └── config.json
│  ├── firebase-export-metadata.json
│  └── firestore_export
│     └── firestore_export.overall_export_metadata
├── firebase.json
├── firestore-debug.log
├── firestore.indexes.json
├── firestore.rules
├── functions
│  ├── .eslintrc.js
│  ├── .firebaserc
│  ├── .gitignore
│  ├── .nyc_output
│  │  └── processinfo
│  │     └── index.json
│  ├── .prettierrc.js
│  ├── babel.config.js
│  ├── coverage
│  │  ├── clover.xml
│  │  ├── coverage-final.json
│  │  ├── lcov-report
│  │  │  ├── base.css
│  │  │  ├── block-navigation.js
│  │  │  ├── favicon.png
│  │  │  ├── index.html
│  │  │  ├── menuCategory.handlers.js.html
│  │  │  ├── menuCategory.handlers.ts.html
│  │  │  ├── menuItem.handlers.js.html
│  │  │  ├── menuItem.handlers.ts.html
│  │  │  ├── prettify.css
│  │  │  ├── prettify.js
│  │  │  ├── rbac
│  │  │  ├── sort-arrow-sprite.png
│  │  │  ├── sorter.js
│  │  │  ├── src
│  │  │  └── test
│  │  └── lcov.info
│  ├── firebase-debug.log
│  ├── firebase.json
│  ├── firestore-debug.log
│  ├── functions
│  │  └── src
│  │     ├── ads
│  │     ├── libs
│  │     ├── notifications
│  │     └── printing
│  ├── index.js
│  ├── jest.config.js
│  ├── lib
│  │  ├── ads
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── attendance
│  │  │  ├── attendance.handlers.js
│  │  │  ├── attendance.handlers.js.map
│  │  │  ├── attendance.routes.js
│  │  │  └── attendance.routes.js.map
│  │  ├── auth
│  │  │  ├── auth.handlers.js
│  │  │  ├── auth.handlers.js.map
│  │  │  ├── auth.routes.js
│  │  │  ├── auth.routes.js.map
│  │  │  ├── auth.types.js
│  │  │  ├── auth.types.js.map
│  │  │  ├── auth.validators.js
│  │  │  ├── auth.validators.js.map
│  │  │  ├── line.handlers.js
│  │  │  ├── line.handlers.js.map
│  │  │  ├── line.service.js
│  │  │  └── line.service.js.map
│  │  ├── communication
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── coupons
│  │  │  ├── coupon.handlers.js
│  │  │  ├── coupon.handlers.js.map
│  │  │  ├── coupon.routes.js
│  │  │  ├── coupon.routes.js.map
│  │  │  ├── coupon.service.js
│  │  │  └── coupon.service.js.map
│  │  ├── discovery
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── routes.js
│  │  │  ├── routes.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── employees
│  │  │  ├── employee.handlers.js
│  │  │  ├── employee.handlers.js.map
│  │  │  ├── employee.routes.js
│  │  │  └── employee.routes.js.map
│  │  ├── equity
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── schedule.handlers.js
│  │  │  ├── schedule.handlers.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── feedback
│  │  │  ├── types.js
│  │  │  ├── types.js.map
│  │  │  ├── webhook.js
│  │  │  └── webhook.js.map
│  │  ├── financial
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── schedules.js
│  │  │  ├── schedules.js.map
│  │  │  ├── services
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── index.js
│  │  ├── index.js.map
│  │  ├── inventory
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── leave
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── routes.js
│  │  │  ├── routes.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── libs
│  │  │  ├── audit
│  │  │  └── rbac
│  │  ├── members
│  │  │  ├── members.handlers.js
│  │  │  ├── members.handlers.js.map
│  │  │  ├── members.routes.js
│  │  │  └── members.routes.js.map
│  │  ├── menus
│  │  │  ├── menu.handlers.js
│  │  │  ├── menu.handlers.js.map
│  │  │  ├── menu.routes.js
│  │  │  ├── menu.routes.js.map
│  │  │  ├── menuCategory.handlers.js
│  │  │  ├── menuCategory.handlers.js.map
│  │  │  ├── menuCategory.routes.js
│  │  │  ├── menuCategory.routes.js.map
│  │  │  ├── menuCategory.validators.js
│  │  │  ├── menuCategory.validators.js.map
│  │  │  ├── menuItem.handlers.js
│  │  │  ├── menuItem.handlers.js.map
│  │  │  ├── menuItem.routes.js
│  │  │  ├── menuItem.routes.js.map
│  │  │  ├── menuItem.validators.js
│  │  │  └── menuItem.validators.js.map
│  │  ├── middleware
│  │  │  ├── auth.js
│  │  │  ├── auth.js.map
│  │  │  ├── auth.middleware.js
│  │  │  ├── auth.middleware.js.map
│  │  │  ├── resource.js
│  │  │  ├── resource.js.map
│  │  │  ├── tenant.js
│  │  │  ├── tenant.js.map
│  │  │  ├── tenant.middleware.js
│  │  │  ├── tenant.middleware.js.map
│  │  │  ├── validation.middleware.js
│  │  │  └── validation.middleware.js.map
│  │  ├── orders
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── order.handlers.js
│  │  │  ├── order.handlers.js.map
│  │  │  ├── order.routes.js
│  │  │  ├── order.routes.js.map
│  │  │  ├── orders.handlers.js
│  │  │  ├── orders.handlers.js.map
│  │  │  ├── orders.routes.js
│  │  │  ├── orders.routes.js.map
│  │  │  ├── orders.service.js
│  │  │  ├── orders.service.js.map
│  │  │  ├── orders.validators.js
│  │  │  ├── orders.validators.js.map
│  │  │  ├── services
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── payments
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── providers
│  │  │  ├── service.js
│  │  │  ├── service.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── payroll
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── service.js
│  │  │  ├── service.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── performance
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── printing
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── routes.js
│  │  │  ├── routes.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── referrals
│  │  │  ├── referral.handlers.js
│  │  │  ├── referral.handlers.js.map
│  │  │  ├── referral.routes.js
│  │  │  ├── referral.routes.js.map
│  │  │  ├── referral.service.js
│  │  │  ├── referral.service.js.map
│  │  │  ├── referral.types.js
│  │  │  ├── referral.types.js.map
│  │  │  ├── referral.validators.js
│  │  │  ├── referral.validators.js.map
│  │  │  ├── referralReward.handlers.js
│  │  │  └── referralReward.handlers.js.map
│  │  ├── roles
│  │  │  ├── roles.handlers.js
│  │  │  ├── roles.handlers.js.map
│  │  │  ├── roles.routes.js
│  │  │  └── roles.routes.js.map
│  │  ├── scheduling
│  │  │  ├── handlers.js
│  │  │  ├── handlers.js.map
│  │  │  ├── routes.js
│  │  │  ├── routes.js.map
│  │  │  ├── types.js
│  │  │  └── types.js.map
│  │  ├── scripts
│  │  │  ├── fix-deploy.js
│  │  │  ├── fix-deploy.js.map
│  │  │  ├── rebuild.js
│  │  │  └── rebuild.js.map
│  │  ├── stores
│  │  │  ├── store.handlers.js
│  │  │  ├── store.handlers.js.map
│  │  │  ├── store.routes.js
│  │  │  └── store.routes.js.map
│  │  ├── superadmin
│  │  │  ├── handlers
│  │  │  ├── index.js
│  │  │  ├── index.js.map
│  │  │  ├── routes
│  │  │  └── types
│  │  ├── test-init.js
│  │  ├── test-init.js.map
│  │  └── users
│  │     ├── user.handlers.js
│  │     ├── user.handlers.js.map
│  │     ├── user.routes.js
│  │     ├── user.routes.js.map
│  │     ├── user.service.js
│  │     ├── user.service.js.map
│  │     ├── user.types.js
│  │     ├── user.types.js.map
│  │     ├── user.validators.js
│  │     └── user.validators.js.map
│  ├── logs
│  │  ├── menu_categories_test_result.log
│  │  └── rbac_middleware_test_result.log
│  ├── package-lock.json
│  ├── package.json
│  ├── public
│  ├── run-tests.bat
│  ├── setCustomClaims.js
│  ├── src
│  │  ├── ads
│  │  │  ├── handlers.ts
│  │  │  └── types.ts
│  │  ├── attendance
│  │  │  ├── attendance.handlers.ts
│  │  │  ├── attendance.routes.ts
│  │  │  ├── attendance.types.ts
│  │  │  └── attendance.validators.ts
│  │  ├── auth
│  │  │  ├── auth.handlers.js
│  │  │  ├── auth.routes.js
│  │  │  ├── auth.types.ts
│  │  │  ├── auth.validators.ts
│  │  │  ├── line.handlers.ts
│  │  │  └── line.service.ts
│  │  ├── communication
│  │  │  ├── handlers.ts
│  │  │  └── types.ts
│  │  ├── coupons
│  │  │  ├── coupon.handlers.js
│  │  │  ├── coupon.routes.js
│  │  │  ├── coupon.service.js
│  │  │  ├── coupons.handlers.ts
│  │  │  ├── coupons.routes.ts
│  │  │  ├── coupons.service.ts
│  │  │  └── coupons.types.ts
│  │  ├── crm
│  │  │  ├── crm.handlers.ts
│  │  │  ├── crm.routes.ts
│  │  │  └── crm.service.ts
│  │  ├── discovery
│  │  │  ├── handlers.ts
│  │  │  ├── index.ts
│  │  │  ├── routes.ts
│  │  │  └── types.ts
│  │  ├── employees
│  │  │  ├── employee.handlers.js
│  │  │  ├── employee.handlers.ts
│  │  │  ├── employee.routes.js
│  │  │  ├── employee.routes.ts
│  │  │  ├── employee.types.ts
│  │  │  └── employee.validators.ts
│  │  ├── equity
│  │  │  ├── equity.handlers.ts
│  │  │  ├── equity.routes.ts
│  │  │  ├── equity.types.ts
│  │  │  ├── handlers.ts
│  │  │  ├── index.ts
│  │  │  ├── schedule.handlers.ts
│  │  │  ├── services
│  │  │  └── types.ts
│  │  ├── feedback
│  │  │  ├── types.ts
│  │  │  └── webhook.ts
│  │  ├── financial
│  │  │  ├── index.ts
│  │  │  ├── schedules.ts
│  │  │  ├── services
│  │  │  └── types.ts
│  │  ├── index.ts
│  │  ├── inventory
│  │  │  ├── handlers.ts
│  │  │  ├── index.ts
│  │  │  ├── inventory.handlers.ts
│  │  │  ├── inventory.routes.ts
│  │  │  ├── inventory.types.ts
│  │  │  └── types.ts
│  │  ├── leave
│  │  │  ├── handlers.ts
│  │  │  ├── leave.handlers.ts
│  │  │  ├── leave.routes.ts
│  │  │  ├── routes.ts
│  │  │  └── types.ts
│  │  ├── libs
│  │  │  ├── audit
│  │  │  ├── linepay
│  │  │  └── rbac
│  │  ├── loyalty
│  │  │  ├── loyalty.handlers.ts
│  │  │  ├── loyalty.routes.ts
│  │  │  ├── loyalty.service.ts
│  │  │  └── loyalty.types.ts
│  │  ├── members
│  │  │  ├── members.handlers.js
│  │  │  └── members.routes.js
│  │  ├── menus
│  │  │  ├── menu.handlers.js
│  │  │  ├── menu.routes.js
│  │  │  ├── menuCategory.handlers.ts
│  │  │  ├── menuCategory.routes.js
│  │  │  ├── menuCategory.routes.ts
│  │  │  ├── menuCategory.validators.ts
│  │  │  ├── menuItem.handlers.ts
│  │  │  ├── menuItem.routes.js
│  │  │  ├── menuItem.routes.ts
│  │  │  ├── menuItem.validators.js
│  │  │  ├── menuItem.validators.ts
│  │  │  └── __tests__
│  │  ├── middleware
│  │  │  ├── auth.middleware.ts
│  │  │  ├── auth.ts
│  │  │  ├── authenticateUser.ts
│  │  │  ├── checkPermissions.ts
│  │  │  ├── rbac.ts
│  │  │  ├── resource.ts
│  │  │  ├── tenant.middleware.ts
│  │  │  ├── tenant.ts
│  │  │  ├── validateRequest.ts
│  │  │  ├── validation.middleware.ts
│  │  │  └── __tests__
│  │  ├── notifications
│  │  │  ├── channels
│  │  │  ├── index.ts
│  │  │  ├── notification.handler.ts
│  │  │  ├── notification.routes.ts
│  │  │  ├── notification.service.ts
│  │  │  ├── notification.types.ts
│  │  │  └── templates
│  │  ├── orders
│  │  │  ├── customer.orders.handlers.ts
│  │  │  ├── customer.orders.routes.ts
│  │  │  ├── customer.orders.validators.ts
│  │  │  ├── index.js
│  │  │  ├── index.ts
│  │  │  ├── order.handlers.js
│  │  │  ├── order.routes.js
│  │  │  ├── orders.handlers.js
│  │  │  ├── orders.handlers.ts
│  │  │  ├── orders.routes.js
│  │  │  ├── orders.routes.ts
│  │  │  ├── orders.service.ts
│  │  │  ├── orders.triggers.ts
│  │  │  ├── orders.validators.ts
│  │  │  ├── services
│  │  │  ├── types.ts
│  │  │  └── __tests__
│  │  ├── payments
│  │  │  ├── handlers.ts
│  │  │  ├── index.ts
│  │  │  ├── payments.handlers.ts
│  │  │  ├── payments.routes.ts
│  │  │  ├── payments.types.ts
│  │  │  ├── providers
│  │  │  ├── service.ts
│  │  │  └── types.ts
│  │  ├── payroll
│  │  │  ├── handlers.ts
│  │  │  ├── index.ts
│  │  │  ├── payroll.handlers.ts
│  │  │  ├── payroll.routes.ts
│  │  │  ├── service.ts
│  │  │  └── types.ts
│  │  ├── performance
│  │  │  ├── handlers.ts
│  │  │  ├── index.ts
│  │  │  └── types.ts
│  │  ├── pickup
│  │  │  ├── index.ts
│  │  │  ├── pickup.handlers.ts
│  │  │  └── pickup.routes.ts
│  │  ├── pos
│  │  │  ├── index.ts
│  │  │  ├── pos.handlers.ts
│  │  │  └── pos.routes.ts
│  │  ├── printing
│  │  │  ├── handlers.ts
│  │  │  ├── index.ts
│  │  │  ├── routes.ts
│  │  │  └── types.ts
│  │  ├── referrals
│  │  │  ├── referral.handlers.js
│  │  │  ├── referral.handlers.ts
│  │  │  ├── referral.routes.js
│  │  │  ├── referral.service.js
│  │  │  ├── referral.service.ts
│  │  │  ├── referral.types.ts
│  │  │  ├── referral.validators.ts
│  │  │  └── referralReward.handlers.js
│  │  ├── roles
│  │  │  ├── roles.handlers.js
│  │  │  ├── roles.handlers.ts
│  │  │  ├── roles.routes.js
│  │  │  ├── roles.routes.ts
│  │  │  ├── roles.types.ts
│  │  │  └── roles.validators.ts
│  │  ├── scheduling
│  │  │  ├── handlers.ts
│  │  │  ├── routes.ts
│  │  │  ├── scheduling.handlers.ts
│  │  │  ├── scheduling.routes.ts
│  │  │  ├── scheduling.types.ts
│  │  │  └── types.ts
│  │  ├── scripts
│  │  │  ├── fix-deploy.js
│  │  │  └── rebuild.js
│  │  ├── stores
│  │  │  ├── store.handlers.js
│  │  │  ├── store.routes.js
│  │  │  ├── stores.handlers.ts
│  │  │  ├── stores.routes.ts
│  │  │  ├── stores.types.ts
│  │  │  └── stores.validation.ts
│  │  ├── superadmin
│  │  │  ├── handlers
│  │  │  ├── index.ts
│  │  │  ├── routes
│  │  │  └── types
│  │  ├── test-init.ts
│  │  ├── tsconfig.json
│  │  ├── types
│  │  │  └── express.d.ts
│  │  └── users
│  │     ├── user.handlers.ts
│  │     ├── user.routes.ts
│  │     ├── user.service.ts
│  │     ├── user.types.ts
│  │     └── user.validators.ts
│  ├── test
│  │  ├── auth.test.js
│  │  ├── employee.mock.js
│  │  ├── employee.test.js
│  │  ├── equity
│  │  │  ├── schedule.handlers.test.ts
│  │  │  └── 結果摘要.txt
│  │  ├── financial
│  │  │  ├── financial.mock.js
│  │  │  ├── financial.mock.ts
│  │  │  ├── lossTracking.direct.test.ts
│  │  │  ├── lossTracking.test.ts
│  │  │  ├── mock-types.js
│  │  │  ├── profitCalculation.direct.test.ts
│  │  │  ├── profitCalculation.test.ts
│  │  │  └── README.md
│  │  ├── firebase-admin-init.test.js
│  │  ├── firebase-admin.mock.js
│  │  ├── firebase-admin.mock.ts
│  │  ├── integration
│  │  │  ├── order-status-change-emulator.test.ts
│  │  │  └── order-status-change.test.ts
│  │  ├── libs
│  │  │  └── rbac
│  │  ├── menu.mock.js
│  │  ├── menu.test.js
│  │  ├── menus
│  │  │  └── menuCategory.handlers.test.ts
│  │  ├── notifications
│  │  │  ├── channels
│  │  │  └── notification.service.test.ts
│  │  ├── orders.mock.js
│  │  ├── orders.test.js
│  │  ├── payments
│  │  │  └── service.test.ts
│  │  ├── rbac_middleware_integration.test.js
│  │  ├── tsconfig.json
│  │  └── 開發紀錄.md
│  ├── test-results.txt
│  ├── tsconfig.json
│  └── tsconfig.test.json
├── get_token.html
├── improvement_summary.txt
├── insertApiSpec.js
├── insert_menu_items.ps1
├── insert_section.ps1
├── jest.config.js
├── language-server-log.txt
├── line.txt
├── menuItems_content.txt
├── menuItems_update.md
├── menu_status.txt
├── package-lock.json
├── package.json
├── public
│  └── index.html
├── scripts
│  ├── init-test-data.js
│  ├── package-lock.json
│  ├── package.json
│  └── test-orders.js
├── setup_firestore_test_users.js
├── setup_test_users.js
├── snapshot.friedg.cjs
├── snapshot.md
├── src
│  ├── components
│  │  ├── common
│  │  │  ├── basic.test.js
│  │  │  ├── FloatingLabelInput.test.tsx
│  │  │  └── simple.test.ts
│  │  └── MenuManagement
│  │     └── MenuItemList.tsx
│  ├── menus
│  │  ├── menuItem.handlers.ts
│  │  └── __tests__
│  │     ├── menuCategory.handlers.test.ts
│  │     └── simple.menuItem.test.ts
│  ├── sample.test.js
│  ├── simpleMath.js
│  ├── simpleMath.test.js
│  ├── simpleMath.test.mjs
│  └── test
│     └── setup.ts
├── temp_date.txt
├── test
│  └── menus
│     ├── menuCategory.handlers.test.js
│     └── menuCategory.handlers.test.ts
├── test-results.txt
├── test.mjs
├── tests
│  └── firestore-rules
│     ├── package-lock.json
│     ├── package.json
│     ├── setup_test_users.js
│     └── test_firestore_rules.js
├── test_coverage.txt
├── test_firestore_rules.js
├── users.json
├── vite.config.ts
├── vitest.config.js
├── web-admin
│  ├── .env
│  ├── .gitignore
│  ├── auth_users.json
│  ├── eslint.config.js
│  ├── functions
│  │  └── src
│  │     ├── functions
│  │     └── loyalty
│  ├── index.html
│  ├── package-lock.json
│  ├── package.json
│  ├── public
│  │  ├── manifest.json
│  │  ├── service-worker.js
│  │  ├── vite.svg
│  │  └── _redirects
│  ├── README.md
│  ├── src
│  │  ├── App.css
│  │  ├── App.tsx
│  │  ├── assets
│  │  │  └── react.svg
│  │  ├── components
│  │  │  ├── AttendanceManagement
│  │  │  ├── checkout
│  │  │  ├── common
│  │  │  ├── EmployeeManagement
│  │  │  ├── EquityManagement
│  │  │  ├── examples
│  │  │  ├── Inventory
│  │  │  ├── LeaveManagement
│  │  │  ├── MenuManagement
│  │  │  ├── OrderManagement
│  │  │  ├── Pos
│  │  │  ├── RoleManagement
│  │  │  ├── Scheduling
│  │  │  └── StoreManagement
│  │  ├── config.ts
│  │  ├── contexts
│  │  │  ├── NotificationContext.tsx
│  │  │  └── PosOrderContext.tsx
│  │  ├── firebaseConfig.ts
│  │  ├── hooks
│  │  │  └── usePermission.ts
│  │  ├── index.css
│  │  ├── layouts
│  │  │  ├── AdminSidebar.tsx
│  │  │  └── MainLayout.tsx
│  │  ├── main.tsx
│  │  ├── mock-data
│  │  │  ├── employees.ts
│  │  │  └── mockMenuItems.ts
│  │  ├── pages
│  │  │  ├── AttendancePage.tsx
│  │  │  ├── coupons
│  │  │  ├── CRM
│  │  │  ├── employee
│  │  │  ├── EmployeesPage.tsx
│  │  │  ├── EmployeeView
│  │  │  ├── EquityManagement
│  │  │  ├── Inventory
│  │  │  ├── LeaveManagementPage.tsx
│  │  │  ├── LoginPage.tsx
│  │  │  ├── loyalty
│  │  │  ├── NotificationPreferencesPage.tsx
│  │  │  ├── PayrollPage.tsx
│  │  │  ├── PosPage.tsx
│  │  │  ├── RolesPage.tsx
│  │  │  ├── SchedulingPage.tsx
│  │  │  └── StoresPage.tsx
│  │  ├── services
│  │  │  ├── api.ts
│  │  │  ├── attendanceService.ts
│  │  │  ├── authService.ts
│  │  │  ├── couponService.ts
│  │  │  ├── crmService.ts
│  │  │  ├── employeeService.ts
│  │  │  ├── equityService.ts
│  │  │  ├── inventoryService.ts
│  │  │  ├── leaveService.ts
│  │  │  ├── loyaltyService.ts
│  │  │  ├── menuService.ts
│  │  │  ├── mock
│  │  │  ├── notificationService.ts
│  │  │  ├── orderService.ts
│  │  │  ├── paymentService.ts
│  │  │  ├── payrollService.ts
│  │  │  ├── posService.ts
│  │  │  ├── roleService.ts
│  │  │  ├── schedulingService.ts
│  │  │  └── storeService.ts
│  │  ├── styles
│  │  │  └── theme.ts
│  │  ├── test
│  │  │  └── setup.ts
│  │  ├── types
│  │  │  ├── employee.ts
│  │  │  ├── equity.types.ts
│  │  │  ├── inventory.types.ts
│  │  │  ├── menuItem.ts
│  │  │  ├── notification.types.ts
│  │  │  ├── order.ts
│  │  │  ├── role.ts
│  │  │  ├── scheduling.types.ts
│  │  │  ├── store.ts
│  │  │  └── user.types.ts
│  │  ├── utils
│  │  │  ├── dateUtils.ts
│  │  │  ├── errorHandler.ts
│  │  │  ├── formatters.ts
│  │  │  └── permissionUtils.ts
│  │  └── vite-env.d.ts
│  ├── tsconfig.app.json
│  ├── tsconfig.json
│  ├── tsconfig.node.json
│  ├── tsconfig.test.json
│  ├── vite.config.ts
│  ├── vitest.config.ts
│  └── web-admin
│     └── src
│        └── components
├── 功能實現報告.md
├── 動態股權章節.txt
├── 員工動態股權制度.txt
├── 員工動態股權制度_UTF8.txt
├── 專案備份
│  ├── config.json
│  ├── 專案備份.exe
│  └── 專案備份.py
├── 整合專案報告.txt
├── 整合專案報告_UTF8.txt
├── 整合專案報告_修復.txt
├── 整合專案報告_備份.txt
├── 整合專案報告_完整版.txt
├── 整合專案報告_帶通知模組.txt
├── 系統開發規範補充.txt
├── 訂單狀態管理實施進度.txt
├── 訂單狀態管理與通知機制.txt
├── 設計文件
│  ├── RBAC函式庫設計_v1.md
│  ├── wireframes
│  │  ├── POS機
│  │  ├── Web管理後台
│  │  │  ├── 員工列表.md
│  │  │  └── 新增員工表單.md
│  │  └── 客戶APP
│  └── 核心資料模型與RBAC_v1.md
├── 通知服務模組章節.txt
├── 通知服務設計規格.txt
├── 開發流程順續.txt
├── 開發紀錄檔.txt
├── 開發紀錄檔_v2.txt
├── 開發紀錄檔_備份.txt
└── 風格
   ├── POS-白卡片黃邊.txt
   ├── 全-切換網頁.txt
   ├── 全-資料送出.txt
   ├── 公佈欄.txt
   ├── 員工或客戶簡麗.txt
   ├── 打勾-藍色框變勾.txt
   ├── 按鈕-紫色太空.txt
   ├── 按鈕-紫色閃電.txt
   ├── 按鈕-迷幻.txt
   ├── 按鈕-黃色興奮.txt
   ├── 排名.txt
   ├── 文字-質感白色燈.txt
   ├── 會員-邀請函.txt
   ├── 線上點餐-結帳刷卡.txt
   ├── 線上點餐-結帳清單.txt
   ├── 線上點餐-總價顯示.txt
   ├── 線上點餐-餐點卡片.txt
   ├── 輸入框.txt
   ├── 輸入表格.txt
   ├── 關於我.txt
   └── 黑金 登入.txt

```

## Function List

### config.json

### firebase-export-1746211287188S4pPQ3\auth_export\accounts.json

### firebase-export-1746211287188S4pPQ3\auth_export\config.json

### firebase-export-1746211287188S4pPQ3\firebase-export-metadata.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### firebase-export-1746211654071QtVfqL\auth_export\accounts.json

### firebase-export-1746211654071QtVfqL\auth_export\config.json

### firebase-export-1746211654071QtVfqL\firebase-export-metadata.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### firebase.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### firestore.indexes.json

### functions\.nyc_output\processinfo\index.json

### functions\coverage\coverage-final.json

### functions\firebase.json

### functions\index.js
- **api(https)** - No comment

### functions\lib\equity\handlers.js
- **checkEquityEligibility(https)** - No comment

### functions\lib\feedback\webhook.js
- **lineBotWebhook(https)** - No comment

### functions\lib\index.js
- **api(https)** - No comment
- **cleanupLogs(https)** - No comment

### functions\package-lock.json

### functions\package.json

### functions\src\attendance\attendance.types.ts
- **calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
)** - No comment

### functions\src\equity\handlers.ts
- **processEquityEligibility(employeeId: string)** - No comment

### functions\src\equity\schedule.handlers.ts
- **openPurchaseWindowFunc()** - No comment
- **closePurchaseWindowFunc()** - No comment

### functions\src\middleware\auth.middleware.ts
- **checkRole()** - No comment

### functions\src\middleware\checkPermissions.ts
- **checkPermissions()** - No comment

### functions\src\middleware\rbac.ts
- **validateRoles()** - No comment

### functions\src\middleware\resource.ts
- **validateResourceAccess()** - No comment

### functions\src\middleware\tenant.middleware.ts
- **withTenantIsolation()** - No comment
- **withStoreIsolation()** - No comment
- **withRole()** - No comment

### functions\src\middleware\tenant.ts
- **validateTenantAccess()** - No comment

### functions\src\middleware\validateRequest.ts
- **validateRequest()** - No comment

### functions\src\middleware\validation.middleware.ts
- **validateRequest()** - No comment

### functions\src\orders\index.js
- **require("firebase-admin")** - No comment
- **app()** - No comment
- **catch(error)** - No comment
- **initializeApp()** - No comment
- **log("Firebase Admin初始化成功 (orders模組)** - No comment
- **require("./orders.handlers")** - No comment

### functions\src\tsconfig.json

### functions\test\employee.mock.js
- **require("sinon")** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **returns(firestoreMock)** - No comment
- **stub()** - No comment
- **join(",")** - No comment
- **join(",")** - No comment
- **Date()** - No comment
- **stub()** - No comment
- **resolves(docSnap)** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **function(error)** - No comment
- **restore()** - No comment
- **stub()** - No comment
- **rejects(error)** - No comment
- **function(error)** - No comment
- **restore()** - No comment
- **stub()** - No comment
- **rejects(error)** - No comment
- **function(error)** - No comment
- **restore()** - No comment
- **stub()** - No comment
- **rejects(error)** - No comment
- **function(error)** - No comment
- **restore()** - No comment
- **stub()** - No comment
- **rejects(error)** - No comment
- **if(Array.isArray(docs)** - No comment
- **if(typeof docs === "object" && docs !== null)** - No comment
- **entries(docs)** - No comment
- **map(([id, data])** - No comment
- **map((doc)** - No comment
- **random()** - No comment
- **toString(36)** - No comment
- **substring(7)** - No comment
- **random()** - No comment
- **toString(36)** - No comment
- **substring(7)** - No comment
- **createQuerySnapshot(docs)** - No comment
- **stub()** - No comment
- **resolves(querySnapshot)** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **entries(docs)** - No comment
- **map(([id, data])** - No comment
- **createDocRef(id, data, true)** - No comment
- **forEach(callback)** - No comment
- **resolves(querySnapshot)** - No comment
- **callsFake((data)** - No comment
- **keys(docs)** - No comment
- **createDocRef(id, newDoc, true)** - No comment
- **resolve(docRef)** - No comment
- **if(docs[id])** - No comment
- **createDocRef(id, docs[id], true)** - No comment
- **createDocRef(id, {}, false)** - No comment
- **returns(collectionRef)** - No comment
- **returns(collectionRef)** - No comment
- **returns(collectionRef)** - No comment
- **returns(collectionRef)** - No comment
- **returns({
    get: sinon.stub()** - No comment
- **resolves({ data: ()** - No comment
- **callsFake((path)** - No comment
- **createCollectionRef({})** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **returns(createBatch()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **callsFake((docRef)** - No comment
- **get()** - No comment
- **stub()** - No comment
- **callsFake(async (callback)** - No comment
- **createTransaction()** - No comment
- **callback(transaction)** - No comment
- **resetHistory()** - No comment
- **resetHistory()** - No comment
- **callsFake((path)** - No comment
- **createCollectionRef({})** - No comment
- **reset()** - No comment

### functions\test\financial\financial.mock.js
- **require("sinon")** - No comment
- **createFirestoreMock()** - No comment
- **entries(documents)** - No comment
- **map(([id, data])** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **callsFake((id)** - No comment
- **stub()** - No comment
- **resolves({
            exists: !!docData,
            data: ()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **returns(createCollectionRef({})** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **resolves({
        empty: docs.length === 0,
        docs,
        size: docs.length,
      })** - No comment
- **stub()** - No comment
- **callsFake((data)** - No comment
- **now()** - No comment
- **resolve({ id })** - No comment
- **constructor(seconds, nanoseconds)** - No comment
- **now()** - No comment
- **Timestamp(Math.floor(Date.now()** - No comment
- **fromDate(date)** - No comment
- **Timestamp(Math.floor(date.getTime()** - No comment
- **toDate()** - No comment
- **Date(this.seconds * 1000)** - No comment
- **stub()** - No comment
- **callsFake((name)** - No comment
- **createCollectionRef({})** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **callsFake(async (callback)** - No comment
- **stub()** - No comment
- **callsFake(async (docRef)** - No comment
- **get()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **callback(transaction)** - No comment
- **Timestamp(Math.floor(Date.now()** - No comment
- **createFirestoreMock()** - No comment
- **stub()** - No comment
- **returns({})** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **returns(firestoreMock)** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **initializeApp()** - No comment
- **stub()** - No comment
- **callsFake((id)** - No comment
- **stub()** - No comment
- **resolves({
            exists: !!docData,
            data: ()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **returns({
            doc: sinon.stub()** - No comment
- **returns({
              get: sinon.stub()** - No comment
- **resolves({ exists: false, data: ()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **resolves({
        empty: Object.keys(documents)** - No comment
- **entries(documents)** - No comment
- **map(([id, data])** - No comment
- **keys(documents)** - No comment
- **stub()** - No comment
- **callsFake((data)** - No comment
- **now()** - No comment
- **resolve({ id })** - No comment
- **resetHistory()** - No comment
- **initializeApp()** - No comment

### functions\test\financial\financial.mock.ts
- **createCollectionRef(documents = {})** - No comment
- **reset()** - No comment

### functions\test\firebase-admin.mock.js
- **require('sinon')** - No comment
- **stub()** - No comment
- **returns({})** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **initializeApp()** - No comment
- **createFirestoreMock()** - No comment
- **entries(documents)** - No comment
- **map(([id, data])** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **callsFake((id)** - No comment
- **stub()** - No comment
- **resolves({
            exists: !!docData,
            data: ()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **returns(createCollectionRef({})** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **resolves({
        empty: docs.length === 0,
        docs,
        size: docs.length,
      })** - No comment
- **stub()** - No comment
- **callsFake((data)** - No comment
- **now()** - No comment
- **resolve({ id })** - No comment
- **constructor(seconds, nanoseconds)** - No comment
- **now()** - No comment
- **Timestamp(Math.floor(Date.now()** - No comment
- **fromDate(date)** - No comment
- **Timestamp(Math.floor(date.getTime()** - No comment
- **toDate()** - No comment
- **Date(this.seconds * 1000)** - No comment
- **stub()** - No comment
- **callsFake((name)** - No comment
- **createCollectionRef({})** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **callsFake(async (callback)** - No comment
- **stub()** - No comment
- **callsFake(async (docRef)** - No comment
- **get()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **callback(transaction)** - No comment
- **Timestamp(Math.floor(Date.now()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **auth()** - 設置 
- **returns(authMock)** - No comment
- **firestore()** - 創建 Firestore mock 並設置 
- **createFirestoreMock()** - No comment
- **returns(firestoreMock)** - No comment
- **stub()** - No comment
- **callsFake((id)** - No comment
- **stub()** - No comment
- **resolves({
            exists: !!docData,
            data: ()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **returns({
            doc: sinon.stub()** - No comment
- **returns({
              get: sinon.stub()** - No comment
- **resolves({ exists: false, data: ()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **resolves()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **returnsThis()** - No comment
- **stub()** - No comment
- **resolves({
        empty: Object.keys(documents)** - No comment
- **entries(documents)** - No comment
- **map(([id, data])** - No comment
- **keys(documents)** - No comment
- **stub()** - No comment
- **callsFake((data)** - No comment
- **now()** - No comment
- **resolve({ id })** - No comment
- **resetHistory()** - No comment
- **initializeApp()** - No comment

### functions\test\firebase-admin.mock.ts
- **createCollectionRef()** - No comment
- **reset()** - No comment

### functions\test\menu.mock.js
- **require('sinon')** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **join(',')** - No comment
- **join(',')** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **returns(firestoreMock)** - No comment
- **stub()** - No comment
- **returns(firestoreMock)** - No comment
- **returns(docSnapshotMock.ref)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **resolves(querySnapshotMock)** - No comment
- **resetHistory()** - No comment
- **returns({})** - No comment

### functions\test\orders.mock.js
- **require("sinon")** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **join(",")** - No comment
- **join(",")** - No comment
- **Date()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **returns(firestoreMock)** - No comment
- **stub()** - No comment
- **returns(firestoreMock)** - No comment
- **returns(docSnapshotMock.ref)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **returns(firestoreMock)** - No comment
- **resolves(querySnapshotMock)** - No comment
- **returns(firestoreMock)** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **stub()** - No comment
- **callsFake(async (transactionHandler)** - No comment
- **transactionHandler(transactionMock)** - No comment
- **resetHistory()** - No comment
- **returns({})** - No comment
- **reset()** - No comment
- **reset()** - No comment
- **reset()** - No comment
- **reset()** - No comment

### functions\test\tsconfig.json

### functions\tsconfig.json

### functions\tsconfig.test.json

### package-lock.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### package.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### scripts\package-lock.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### scripts\package.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### src\simpleMath.js
- **add(a, b)** - No comment
- **multiply(a, b)** - No comment

### tests\firestore-rules\package-lock.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### tests\firestore-rules\package.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### users.json

### web-admin\auth_users.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### web-admin\package-lock.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### web-admin\package.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### web-admin\public\manifest.json

### web-admin\public\service-worker.js
- **install()** - No comment
- **activate()** - No comment
- **fetch()** - No comment
- **push()** - No comment
- **notificationclick()** - No comment

### web-admin\src\services\attendanceService.ts
- **getMockEmployees()** - No comment
- **getMockStores()** - No comment

### web-admin\tsconfig.app.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### web-admin\tsconfig.json

### web-admin\tsconfig.node.json
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment
- **undefined(undefined)** - No comment

### web-admin\tsconfig.test.json

### 專案備份\config.json

## Special Files

### firestore.rules
```

```

## Dependency List

### functions

#### dependencies
```json
{
  "@line/bot-sdk": "^9.9.0",
  "@types/crypto-js": "^4.2.2",
  "axios": "^1.9.0",
  "cors": "^2.8.5",
  "crypto-js": "^4.2.0",
  "express": "^4.18.2",
  "firebase-admin": "^11.8.0",
  "firebase-functions": "^6.3.2",
  "geofirestore": "^5.2.0",
  "handlebars": "^4.7.8",
  "luxon": "^3.4.4",
  "nodemailer": "^6.9.10",
  "twilio": "^4.23.0",
  "uuid": "^9.0.0",
  "zod": "^3.23.0"
}
```
#### devDependencies
```json
{
  "@babel/core": "^7.27.1",
  "@babel/plugin-transform-modules-commonjs": "^7.27.1",
  "@babel/preset-env": "^7.27.2",
  "@babel/preset-typescript": "^7.27.1",
  "@types/cors": "^2.8.17",
  "@types/express": "^4.17.17",
  "@types/jest": "^29.5.14",
  "@types/luxon": "^3.4.2",
  "@types/mocha": "^10.0.10",
  "@types/node": "^22.15.3",
  "@types/nodemailer": "^6.4.14",
  "@types/twilio": "^3.19.3",
  "@types/uuid": "^9.0.1",
  "babel-jest": "^29.7.0",
  "babel-plugin-module-resolver": "^5.0.2",
  "chai": "^4.3.7",
  "cross-env": "^7.0.3",
  "eslint": "^8.57.0",
  "eslint-config-google": "^0.14.0",
  "firebase-functions-test": "^3.4.1",
  "jest": "^29.7.0",
  "mocha": "^11.2.2",
  "proxyquire": "^2.1.3",
  "sinon": "^7.5.0",
  "sinon-chai": "^3.3.0",
  "ts-jest": "^29.3.2",
  "typescript": "^5.0.4"
}
```
### root

#### dependencies
```json
{
  "@emotion/react": "^11.11.4",
  "@emotion/styled": "^11.11.5",
  "@mui/icons-material": "^5.15.0",
  "@mui/material": "^5.15.0",
  "@mui/x-date-pickers": "^6.20.1",
  "@tanstack/react-query": "^5.75.5",
  "axios": "^1.7.2",
  "dayjs": "^1.11.11",
  "formik": "^2.4.6",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.24.0",
  "yup": "^1.6.1"
}
```
#### devDependencies
```json
{
  "@eslint/js": "^9.22.0",
  "@firebase/rules-unit-testing": "^4.0.1",
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/react": "^16.3.0",
  "@testing-library/user-event": "^14.6.1",
  "@types/jest": "^29.5.14",
  "@types/node": "^20.14.9",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@vitejs/plugin-react": "^4.3.1",
  "eslint": "^8.57.0",
  "eslint-plugin-react-hooks": "^4.6.2",
  "eslint-plugin-react-refresh": "^0.4.7",
  "firebase": "^11.6.1",
  "firebase-admin": "^13.3.0",
  "globals": "^16.0.0",
  "jsdom": "^26.1.0",
  "typescript": "^5.2.2",
  "typescript-eslint": "^8.26.1",
  "vite": "^5.3.1",
  "vitest": "^3.1.2"
}
```
### scripts

#### dependencies
```json
{
  "firebase": "^10.9.0"
}
```
#### devDependencies
```json
{}
```
### tests\firestore-rules

#### dependencies
```json
{
  "@firebase/rules-unit-testing": "^4.0.1",
  "firebase": "^11.6.1",
  "firebase-admin": "^13.3.0"
}
```
#### devDependencies
```json
{}
```
### web-admin

#### dependencies
```json
{
  "@emotion/react": "^11.11.4",
  "@emotion/styled": "^11.11.5",
  "@mui/icons-material": "^5.15.0",
  "@mui/lab": "^5.0.0-alpha.160",
  "@mui/material": "^5.15.0",
  "@mui/x-date-pickers": "^6.20.1",
  "axios": "^1.7.2",
  "date-fns": "^3.6.0",
  "dayjs": "^1.11.11",
  "firebase": "9.22.2",
  "formik": "^2.4.6",
  "notistack": "^3.0.2",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-query": "^3.39.3",
  "react-router-dom": "^6.24.0",
  "yup": "^1.6.1"
}
```
#### devDependencies
```json
{
  "@eslint/js": "^9.22.0",
  "@testing-library/jest-dom": "^6.4.2",
  "@testing-library/react": "^14.2.1",
  "@testing-library/user-event": "^14.5.2",
  "@types/connect-history-api-fallback": "^1.5.4",
  "@types/lodash": "^4.17.16",
  "@types/node": "^20.14.9",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@vitejs/plugin-react": "^4.3.1",
  "connect-history-api-fallback": "^2.0.0",
  "eslint": "^8.57.0",
  "eslint-plugin-react-hooks": "^4.6.2",
  "eslint-plugin-react-refresh": "^0.4.7",
  "globals": "^16.0.0",
  "jsdom": "^24.0.0",
  "typescript": "^5.2.2",
  "typescript-eslint": "^8.26.1",
  "vite": "^5.3.1",
  "vitest": "^1.2.2"
}
```
