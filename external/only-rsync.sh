#!/bin/bash

if [ -n "$SSH_ORIGINAL_COMMAND" ]; then
        if [[ "$SSH_ORIGINAL_COMMAND" =~ ^rsync\  ]]; then
            exec $SSH_ORIGINAL_COMMAND --chmod=a+rwX
        fi
fi
