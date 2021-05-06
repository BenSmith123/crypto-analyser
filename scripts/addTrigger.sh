
# add the existing AWS EventBridge trigger to a lambda function
# https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html

# rule is already created
# aws events put-rule \
#	--name my-scheduled-rule \
#	--schedule-expression 'rate(5 minutes)'

# give the rule permission to invoke the lambda function
aws lambda add-permission \
	--function-name crypto-analyser \
	--statement-id cron-15-minutes \
	--action 'lambda:InvokeFunction' \
	--principal events.amazonaws.com \
	--source-arn arn:aws:events:ap-southeast-2:793861092533:rule/cron-15-minutes \
	--profile bensmith


aws events put-targets \
	--rule cron-15-minutes \
	--targets file://scripts/eventBridgeTargets.json \
	--profile bensmith

