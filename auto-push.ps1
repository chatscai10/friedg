# 自動Git提交與推送腳本
$commitMessage = "自動提交 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git add .
git commit -m $commitMessage
git push

# 可在任務計劃程式中設置此腳本定期執行 