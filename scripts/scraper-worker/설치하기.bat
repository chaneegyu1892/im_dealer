@echo off
chcp 65001 > nul
title Capital Rate Collector - Setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
