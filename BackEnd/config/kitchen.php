<?php

return [
    'prep_lead_time_minutes' => max(0, (int) env('KITCHEN_PREP_LEAD_TIME_MINUTES', 30)),
];
