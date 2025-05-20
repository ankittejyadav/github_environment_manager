@echo off
echo ========================================
echo Installing Angular 16 dependencies...
echo ========================================
call npm install

echo.
echo ========================================
echo Running Angular 16 development server...
echo ========================================
echo.
call node_modules\.bin\ng serve --open
