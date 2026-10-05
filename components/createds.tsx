
import { Card, CardContent } from './ui/card'
import { Progress } from './ui/progress'

export const Createds = () => {
  return (
    <Card className='group-data-[collapsible=icon]:hidden'>
        <CardContent className='flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
                <p>2 files created</p>
                <p>total 3</p>
            </div>
            <Progress value={30} />
        </CardContent>
    </Card>
  )
}
